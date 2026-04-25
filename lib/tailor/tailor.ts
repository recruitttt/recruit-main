// The tailor agent. Takes a UserProfile + JobResearch, produces a
// TailoredResume via gpt-4o-mini in JSON mode. Anti-fabrication validator
// rejects any employer in the output that isn't in the input profile.
// One retry with a temperature-0 nudge on failure.

import { chatJSON, extractJSONBlock } from "@/lib/openai";
import type { UserProfile } from "@/lib/profile";
import { TAILOR_SYSTEM_PROMPT, tailorUserPrompt } from "./prompt";
import { computeKeywordCoverage } from "./score";
import type { JobResearch, TailoredProject, TailoredResume } from "./types";

const BANNED_CLICHES = [
  "passionate about",
  "leveraged",
  "spearheaded",
  "synergy",
  "results-driven",
  "team player",
];

export type ResumeQualityResult = {
  ok: boolean;
  hardOk: boolean;
  issues: string[];
  hardIssues: string[];
  passed: string[];
  failed: string[];
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function hasNameMatch(value: string, candidates: string[]): boolean {
  const n = normalizeName(value);
  if (!n) return true;
  return candidates.some((candidate) => {
    const c = normalizeName(candidate);
    return c.length > 0 && (c.includes(n) || n.includes(c));
  });
}

function repoSkills(profile: UserProfile): string[] {
  return (profile.github?.topRepos ?? [])
    .map((repo) => repo.language)
    .filter((language): language is string => Boolean(language && language.trim()));
}

function supportedSkills(profile: UserProfile): string[] {
  return [
    ...profile.skills,
    ...repoSkills(profile),
    ...profileBackedSkillPhrases(profile),
  ];
}

function profileBackedSkillPhrases(profile: UserProfile): string[] {
  const text = [
    profile.headline,
    profile.summary,
    ...profile.experience.flatMap((experience) => [
      experience.title,
      experience.description,
    ]),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const phrases = new Set<string>();
  for (const value of text) {
    for (const phrase of skillLikePhrases(value)) {
      phrases.add(phrase);
    }
  }
  return [...phrases];
}

function skillLikePhrases(text: string): string[] {
  const normalized = text
    .replace(/[/+]/g, " ")
    .replace(/[^a-zA-Z0-9.#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const phrases: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    for (const length of [2, 3]) {
      const phrase = words.slice(index, index + length).join(" ");
      if (phrase.split(" ").length === length) phrases.push(phrase);
    }
  }
  return phrases;
}

function normalizeProjects(rawProjects: unknown, profile: UserProfile): TailoredProject[] {
  if (!Array.isArray(rawProjects)) {
    return [];
  }
  const profileRepos = profile.github?.topRepos ?? [];
  return rawProjects
    .map((p) => {
      const name = typeof p?.name === "string" ? p.name : "";
      const repo = profileRepos.find((r) => hasNameMatch(name, [r.name]));
      return {
        name,
        url: typeof p?.url === "string" && p.url.trim() ? p.url : repo?.url,
        technologies: asStringArray(p?.technologies).slice(0, 6),
        bullets: asStringArray(p?.bullets).slice(0, 3),
      };
    })
    .filter((p) => p.name.trim());
}

export function normalizeResume(raw: unknown, profile: UserProfile): TailoredResume {
  const r = (raw ?? {}) as Partial<TailoredResume>;
  const qualityIssues = asStringArray(r.tailoringNotes?.qualityIssues);
  const passed = asStringArray(r.tailoringNotes?.qualityChecks?.passed);
  const failed = asStringArray(r.tailoringNotes?.qualityChecks?.failed);
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name : profile.name ?? "",
    email: typeof r.email === "string" && r.email.trim() ? r.email : profile.email ?? "",
    location: typeof r.location === "string" ? r.location : profile.location,
    links: {
      github: r.links?.github ?? profile.links.github,
      linkedin: r.links?.linkedin ?? profile.links.linkedin,
      website: r.links?.website ?? profile.links.website,
    },
    headline: typeof r.headline === "string" ? r.headline : profile.headline ?? "",
    summary: typeof r.summary === "string" ? r.summary : profile.summary ?? "",
    skills: asStringArray(r.skills).slice(0, 12),
    experience: Array.isArray(r.experience)
      ? r.experience.map((e) => ({
          company: typeof e?.company === "string" ? e.company : "",
          title: typeof e?.title === "string" ? e.title : "",
          location: typeof e?.location === "string" ? e.location : undefined,
          startDate: typeof e?.startDate === "string" ? e.startDate : undefined,
          endDate: typeof e?.endDate === "string" ? e.endDate : undefined,
          bullets: asStringArray(e?.bullets),
        }))
      : [],
    education: Array.isArray(r.education)
      ? r.education.map((e) => ({
          school: typeof e?.school === "string" ? e.school : "",
          degree: typeof e?.degree === "string" ? e.degree : undefined,
          field: typeof e?.field === "string" ? e.field : undefined,
          endDate: typeof e?.endDate === "string" ? e.endDate : undefined,
        }))
      : [],
    projects: normalizeProjects(r.projects, profile),
    coverLetterBlurb:
      typeof r.coverLetterBlurb === "string" && r.coverLetterBlurb.trim()
        ? r.coverLetterBlurb
        : undefined,
    tailoringNotes: {
      matchedKeywords: asStringArray(r.tailoringNotes?.matchedKeywords),
      emphasizedExperience: asStringArray(r.tailoringNotes?.emphasizedExperience),
      gaps: asStringArray(r.tailoringNotes?.gaps),
      confidence: clamp(Number(r.tailoringNotes?.confidence ?? 0), 0, 100),
      qualityIssues,
      qualityChecks: {
        passed,
        failed,
      },
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function addIssue(
  result: ResumeQualityResult,
  check: string,
  issue: string,
  hard = false
): void {
  result.issues.push(issue);
  result.failed.push(check);
  if (hard) {
    result.hardIssues.push(issue);
  }
}

function pass(result: ResumeQualityResult, check: string): void {
  result.passed.push(check);
}

function allBulletText(resume: TailoredResume): string[] {
  return [
    ...resume.experience.flatMap((role) => role.bullets ?? []),
    ...resume.projects.flatMap((project) => project.bullets ?? []),
  ];
}

export function validateResumeQuality(
  resume: TailoredResume,
  profile: UserProfile,
  research: JobResearch
): ResumeQualityResult {
  const result: ResumeQualityResult = {
    ok: true,
    hardOk: true,
    issues: [],
    hardIssues: [],
    passed: [],
    failed: [],
  };

  if (!resume.name.trim()) addIssue(result, "header", "missing_name", true);
  if (!resume.email.trim()) addIssue(result, "header", "missing_email", true);
  if (profile.links.github && !resume.links.github) addIssue(result, "header", "missing_github_link");
  if (profile.links.linkedin && !resume.links.linkedin) addIssue(result, "header", "missing_linkedin_link");
  if (!result.failed.includes("header")) pass(result, "header");

  if (profile.experience.length > 0 && resume.experience.length === 0) {
    addIssue(result, "experience", "missing_experience_section", true);
  } else if (resume.experience.length > 0) {
    pass(result, "experience");
  }

  if (profile.education.length > 0 && resume.education.length === 0) {
    addIssue(result, "education", "missing_education_section");
  } else if (resume.education.length > 0 || profile.education.length === 0) {
    pass(result, "education");
  }

  if (profile.skills.length > 0 && resume.skills.length === 0) {
    addIssue(result, "skills", "missing_skills_section", true);
  } else if (resume.skills.length > 0) {
    pass(result, "skills");
  }

  const knownEmployers = profile.experience.map((e) => e.company);
  const fabricatedEmployers = resume.experience
    .map((role) => role.company)
    .filter((company) => company && !hasNameMatch(company, knownEmployers));
  if (fabricatedEmployers.length > 0) {
    addIssue(
      result,
      "employers",
      `fabricated_employers:${fabricatedEmployers.join(",")}`,
      true
    );
  } else {
    pass(result, "employers");
  }

  const sourceSkills = supportedSkills(profile);
  const unsupportedSkills = resume.skills.filter((skill) => !hasNameMatch(skill, sourceSkills));
  if (unsupportedSkills.length > 0) {
    addIssue(result, "skills", `unsupported_skills:${unsupportedSkills.join(",")}`, true);
  }

  const sourceProjects = profile.github?.topRepos ?? [];
  if (sourceProjects.length > 0 && resume.projects.length === 0) {
    addIssue(result, "projects", "missing_projects_section");
  }
  const fabricatedProjects = resume.projects
    .map((project) => project.name)
    .filter((name) => name && !hasNameMatch(name, sourceProjects.map((repo) => repo.name)));
  if (fabricatedProjects.length > 0) {
    addIssue(result, "projects", `fabricated_projects:${fabricatedProjects.join(",")}`, true);
  } else if (resume.projects.length > 0 || sourceProjects.length === 0) {
    pass(result, "projects");
  }

  const bullets = allBulletText(resume);
  const rolesWithoutBullets = resume.experience.filter((role) => role.bullets.length === 0).length;
  const projectsWithoutBullets = resume.projects.filter((project) => project.bullets.length === 0)
    .length;
  const emptyBullets = bullets.filter((bullet) => !bullet.trim()).length;
  const weakBullets = bullets.filter((bullet) => {
    const words = wordCount(bullet);
    return words > 0 && words < 4;
  }).length;
  const overlongBullets = bullets.filter((bullet) => wordCount(bullet) > 32).length;
  if (rolesWithoutBullets > 0) {
    addIssue(result, "bullets", `roles_without_bullets:${rolesWithoutBullets}`, true);
  }
  if (projectsWithoutBullets > 0) {
    addIssue(result, "bullets", `projects_without_bullets:${projectsWithoutBullets}`);
  }
  if (emptyBullets > 0) addIssue(result, "bullets", `empty_bullets:${emptyBullets}`, true);
  if (weakBullets > 0) addIssue(result, "bullets", `weak_bullets:${weakBullets}`);
  if (overlongBullets > 0) addIssue(result, "bullets", `overlong_bullets:${overlongBullets}`);
  if (
    rolesWithoutBullets === 0 &&
    projectsWithoutBullets === 0 &&
    emptyBullets === 0 &&
    weakBullets === 0 &&
    overlongBullets === 0
  ) {
    pass(result, "bullets");
  }

  const resumeText = [
    resume.headline,
    resume.summary,
    resume.skills.join(" "),
    bullets.join(" "),
  ].join(" ").toLowerCase();
  const cliches = BANNED_CLICHES.filter((phrase) => resumeText.includes(phrase));
  if (cliches.length > 0) {
    addIssue(result, "language", `banned_cliches:${cliches.join(",")}`);
  } else {
    pass(result, "language");
  }

  const coverage = computeKeywordCoverage(resume, research);
  if (coverage.matched.length + coverage.missing.length > 0 && coverage.coverage < 30) {
    addIssue(result, "keywords", `low_keyword_coverage:${coverage.coverage}`);
  } else {
    pass(result, "keywords");
  }

  result.failed = Array.from(new Set(result.failed));
  result.passed = Array.from(new Set(result.passed)).filter((check) => !result.failed.includes(check));
  result.hardOk = result.hardIssues.length === 0;
  result.ok = result.issues.length === 0;
  return result;
}

function attachQuality(
  resume: TailoredResume,
  quality: ResumeQualityResult
): TailoredResume {
  return {
    ...resume,
    tailoringNotes: {
      ...resume.tailoringNotes,
      qualityIssues: quality.issues,
      qualityChecks: {
        passed: quality.passed,
        failed: quality.failed,
      },
    },
  };
}

export async function tailorResume(
  profile: UserProfile,
  research: JobResearch,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ ok: true; resume: TailoredResume } | { ok: false; reason: string }> {
  const model = process.env.TAILOR_MODEL ?? "gpt-4o-mini";
  const baseMessages = [
    { role: "system" as const, content: TAILOR_SYSTEM_PROMPT },
    { role: "user" as const, content: tailorUserPrompt(profile, research) },
  ];

  const first = await chatJSON(apiKey, baseMessages, { model, temperature: 0.3, signal });
  if (!first.ok) return { ok: false, reason: `tailor_call_failed: ${first.reason}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSONBlock(first.raw));
  } catch {
    parsed = null;
  }

  let resume = normalizeResume(parsed ?? {}, profile);
  let quality = validateResumeQuality(resume, profile, research);

  if (quality.ok) {
    return { ok: true, resume: attachQuality(resume, quality) };
  }

  // Retry once: tell the model what it did wrong, ask for valid JSON,
  // pin temperature at 0.
  const retryNudge = [
    "Your previous output failed deterministic resume quality checks.",
    `Issues: ${quality.issues.join(", ")}`,
    "Re-output the full JSON only, conforming exactly to the schema.",
    "Use only candidate-backed employers, skills, dates, metrics, and GitHub projects.",
    "The PDF will render only Header, Experience, Education, Skills, Projects.",
  ].join("\n");

  const retry = await chatJSON(
    apiKey,
    [...baseMessages, { role: "user", content: retryNudge }],
    { model, temperature: 0, signal }
  );
  if (!retry.ok) return { ok: false, reason: `tailor_retry_failed: ${retry.reason}` };

  try {
    parsed = JSON.parse(extractJSONBlock(retry.raw));
  } catch {
    return { ok: false, reason: "tailor_parse_failed" };
  }
  resume = normalizeResume(parsed ?? {}, profile);
  quality = validateResumeQuality(resume, profile, research);

  if (!quality.hardOk) {
    return {
      ok: false,
      reason: `tailor_quality_failed: ${quality.hardIssues.join(", ")}`,
    };
  }

  return { ok: true, resume: attachQuality(resume, quality) };
}
