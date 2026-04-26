import type { UserProfile } from "@/lib/profile";
import { tailorResume, validateResumeQuality } from "@/lib/tailor/tailor";
import type { JobResearch, TailoredResume } from "@/lib/tailor/types";
import type { BenchmarkMetadata, BenchmarkSample, JobKeywords } from "./types";
import { extractFallbackKeywords, normalizeKeywords } from "./scoring";

export async function tailorWithRecruit(
  sample: BenchmarkSample,
  jobKeywords: JobKeywords,
  apiKey: string
): Promise<
  | { ok: true; resume: TailoredResume; text: string; qualityIssues: string[] }
  | { ok: false; reason: string }
> {
  const profile = profileFromResumeText(sample);
  const research = researchFromSample(sample, jobKeywords);
  const tailored = await tailorResume(profile, research, apiKey);
  if (!tailored.ok) return tailored;
  const quality = validateResumeQuality(tailored.resume, profile, research);
  return {
    ok: true,
    resume: tailored.resume,
    text: textFromTailoredResume(tailored.resume),
    qualityIssues: quality.issues,
  };
}

export function profileFromResumeText(sample: BenchmarkSample): UserProfile {
  const lines = sample.resumeText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const metadata = sample.metadata;
  const details = recordAt(metadata?.details);
  const personalInfo = recordAt(metadata?.personalInfo);
  const structured = metadata?.structuredProfile;
  const skills = supportedSkills(sample, metadata);
  const experience = experienceFromMetadata(metadata, sample.resumeText);
  const education = educationFromMetadata(metadata);
  const projects = projectsFromMetadata(metadata);
  const name = cleanIdentity(structured?.name) ?? cleanIdentity(stringAt(details?.name, personalInfo?.name));
  const email = cleanIdentity(structured?.email) ?? cleanIdentity(stringAt(details?.email_id, personalInfo?.email));
  const location = cleanIdentity(structured?.location) ?? cleanIdentity(stringAt(details?.location));
  return {
    name: name ?? "Benchmark Candidate",
    email: email ?? "candidate@example.test",
    location,
    headline:
      cleanIdentity(structured?.currentPosition) ??
      lines[0]?.slice(0, 120) ??
      "Benchmark candidate",
    summary: stringAt(details?.executive_summary) ?? sample.resumeText.slice(0, 500),
    links: {},
    resume: {
      filename: `${sample.sampleId}.txt`,
      rawText: sample.resumeText,
      uploadedAt: new Date(0).toISOString(),
    },
    experience,
    education,
    skills,
    github: projects.length > 0 ? {
      topRepos: projects.map((project) => ({
        name: project.name,
        description: project.description,
        language: project.language,
        url: project.url ?? `benchmark://${sample.sampleId}/${slug(project.name)}`,
      })),
    } : undefined,
    prefs: { roles: [], locations: [] },
    suggestions: [],
    provenance: {},
    log: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function researchFromSample(sample: BenchmarkSample, jobKeywords: JobKeywords): JobResearch {
  const normalized = normalizeKeywords(jobKeywords);
  return {
    jobUrl: `benchmark://${sample.sampleId}`,
    company: "Benchmark Company",
    role: sample.roleFamily ?? "Benchmark Role",
    jdSummary: sample.jobDescription.slice(0, 800),
    responsibilities: normalized.other.slice(0, 12),
    requirements: normalized.required.length > 0 ? normalized.required : sample.minimumRequirements,
    niceToHaves: normalized.preferred,
    techStack: [...normalized.required, ...normalized.preferred, ...normalized.other].slice(0, 20),
    companyMission: "",
    companyProducts: [],
    cultureSignals: [],
    source: "ingested-description",
    modelDurationMs: 0,
  };
}

export function textFromTailoredResume(resume: TailoredResume): string {
  return [
    resume.headline,
    resume.summary,
    resume.skills.join(" "),
    ...resume.experience.flatMap((item) => [
      item.title,
      item.company,
      ...item.bullets,
    ]),
    ...resume.education.flatMap((item) => [item.school, item.degree, item.field]),
    ...resume.projects.flatMap((item) => [item.name, ...(item.technologies ?? []), ...item.bullets]),
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .join("\n");
}

function extractLikelySkills(text: string): string[] {
  const known = [
    "TypeScript",
    "JavaScript",
    "React",
    "Next.js",
    "Node.js",
    "Python",
    "Postgres",
    "SQL",
    "AWS",
    "Docker",
    "Kubernetes",
    "Machine Learning",
    "LLM",
    "API",
    "GraphQL",
    "Java",
    "Go",
    "Rust",
    "Figma",
    "Product Management",
    "Automation",
    "Power Distribution",
    "Electrical measurements",
    "Hardware design",
    "Business Analysis",
    "Operations Management",
    "Project Management",
    "Accounts Management",
    "Lead Generation",
    "Client Conversion",
    "Department Management",
    "Communication",
    "Interpersonal Skills",
    "Computer Skills",
    "Programming",
  ];
  const lower = text.toLowerCase();
  const matched = known.filter((skill) => lower.includes(skill.toLowerCase()));
  return matched.length > 0 ? matched.slice(0, 12) : ["Communication", "Execution"];
}

function supportedSkills(sample: BenchmarkSample, metadata?: BenchmarkMetadata): string[] {
  const structuredSkills = metadata?.structuredProfile?.skills ?? [];
  const detailSkills = arrayOfStrings(recordAt(metadata?.details)?.skills);
  const requirementKeywords = extractFallbackKeywords(sample.minimumRequirements.join("\n")).keywords ?? [];
  const resumeBackedRequirements = sample.minimumRequirements.filter((requirement) =>
    includesPhrase(sample.resumeText, requirement)
  );
  const resumeBackedRequirementKeywords = requirementKeywords.filter((keyword) =>
    includesPhrase(sample.resumeText, keyword)
  );
  const known = extractLikelySkills(sample.resumeText);
  const capitalized = extractCapitalizedPhrases(sample.resumeText);
  const combined = uniqueStrings([
    ...structuredSkills,
    ...detailSkills,
    ...resumeBackedRequirements,
    ...resumeBackedRequirementKeywords,
    ...known,
    ...capitalized,
  ]);
  return combined.length > 0 ? combined.slice(0, 30) : ["Communication", "Execution"];
}

function experienceFromMetadata(metadata: BenchmarkMetadata | undefined, resumeText: string): UserProfile["experience"] {
  const details = recordAt(metadata?.details);
  const personalInfo = recordAt(metadata?.personalInfo);
  const history = arrayOfRecords(details?.employment_history);
  const mapped = history.map((item) => ({
    company: stringAt(item.company_name) ?? companyFromDetails(stringAt(item.details)) ?? "Unknown Company",
    title: stringAt(item.job_title) ?? stringAt(item.title) ?? "Professional Experience",
    startDate: stringAt(item.start_date),
    endDate: stringAt(item.end_date),
    location: stringAt(item.location),
    description: stringAt(item.details),
  })).filter((item) => item.company !== "Unknown Company" || Boolean(item.description));
  if (mapped.length > 0) return mapped;

  const currentCompany = stringAt(personalInfo?.current_company);
  const currentPosition = stringAt(personalInfo?.current_position);
  if (currentCompany || currentPosition) {
    return [{
      company: currentCompany ?? "Unknown Company",
      title: currentPosition ?? "Professional Experience",
      startDate: stringAt(personalInfo?.employment_start_date_current_company),
      description: [currentPosition, currentCompany].filter(Boolean).join(" at "),
    }];
  }
  return fallbackExperienceFromResumeText(resumeText);
}

function educationFromMetadata(metadata?: BenchmarkMetadata): UserProfile["education"] {
  return arrayOfRecords(recordAt(metadata?.details)?.education)
    .map((item) => ({
      school: stringAt(item.university, item.school, item.institution) ?? "",
      degree: stringAt(item.degree_title, item.degree),
      field: stringAt(item.field, item.major),
      endDate: stringAt(item.end_date),
    }))
    .filter((item) => item.school || item.degree);
}

function projectsFromMetadata(metadata?: BenchmarkMetadata): Array<{
  name: string;
  description?: string;
  language?: string;
  url?: string;
}> {
  return arrayOfRecords(recordAt(metadata?.details)?.projects)
    .map((item) => ({
      name: stringAt(item.title, item.name) ?? "",
      description: stringAt(item.description),
      language: stringAt(item.language),
      url: stringAt(item.url),
    }))
    .filter((item) => item.name);
}

function stringAt(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function cleanIdentity(value?: string): string | undefined {
  if (!value || /^\[(email|phone)\]$/i.test(value) || /^not provided$/i.test(value) || /^none$/i.test(value)) {
    return undefined;
  }
  return value;
}

function recordAt(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(recordAt(item)))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function fallbackExperienceFromResumeText(resumeText: string): UserProfile["experience"] {
  return extractLikelyEmployers(resumeText).slice(0, 8).map((company, index) => ({
    company,
    title: index === 0 ? "Professional Experience" : "Prior Experience",
    description: sentenceNear(resumeText, company) ?? company,
  }));
}

function extractLikelyEmployers(text: string): string[] {
  const chunks = text
    .split(/\n|\||•|/g)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 3 && chunk.length <= 140);
  const employers: string[] = [];
  const suffixRe = /\b([A-Z][A-Za-z0-9&(). -]*?(?:PVT LTD|Pvt Ltd|Pvt\. Ltd\.|LLC|Inc\.?|Limited|Ltd\.?|Global|Group|Telecom|Solutions|Technologies|Systems|University|Bank|School|College)[A-Za-z0-9&(). -]*)\b/g;
  for (const chunk of chunks) {
    for (const match of chunk.matchAll(suffixRe)) {
      employers.push(cleanEmployer(match[1]));
    }
    const roleCompany = chunk.match(/\b(?:EXECUTIVE|MANAGER|OFFICER|ENGINEER|DEVELOPER|ANALYST|CONSULTANT|LEAD)\s+([A-Z][A-Za-z0-9&(). -]{2,50})$/);
    if (roleCompany) employers.push(cleanEmployer(roleCompany[1]));
    if (/^[A-Z]{2,}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?$/.test(chunk)) {
      employers.push(cleanEmployer(chunk));
    }
  }
  return uniqueStrings(employers.filter(Boolean));
}

function cleanEmployer(value: string): string {
  return value
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b.*$/i, "")
    .replace(/\b\d{4}\b.*$/, "")
    .replace(/,\s*(Pakistan|Lahore|Karachi|Gujranwala|Remote).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceNear(text: string, needle: string): string | undefined {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return undefined;
  return text
    .slice(Math.max(0, index - 120), Math.min(text.length, index + 180))
    .replace(/\s+/g, " ")
    .trim();
}

function extractCapitalizedPhrases(text: string): string[] {
  const matches = text
    .replace(/\s+/g, " ")
    .match(/\b[A-Z][A-Za-z+#/&.-]+(?:\s+[A-Z][A-Za-z+#/&.-]+){0,3}\b/g) ?? [];
  return matches
    .map((match) => match.trim())
    .filter((match) =>
      match.length >= 4 &&
      match.length <= 50 &&
      !/^(THE|AND|FOR|WITH|WORK|EXPERIENCE|EDUCATION|PROJECTS|PROFILE|SUMMARY)$/i.test(match)
    )
    .slice(0, 80);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function includesPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function companyFromDetails(details?: string): string | undefined {
  return details?.match(/\bat\s+([^,\n]+)/i)?.[1]?.trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}
