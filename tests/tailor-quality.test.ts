import assert from "node:assert/strict";
import { renderResumeHtml } from "../lib/resume-html";
import { computeTailoringScore } from "../lib/tailor/score";
import { normalizeResume, validateResumeQuality } from "../lib/tailor/tailor";
import type { JobResearch, TailoredResume } from "../lib/tailor/types";
import type { UserProfile } from "../lib/profile";

const profile: UserProfile = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  links: {
    github: "https://github.com/ada",
    linkedin: "https://linkedin.com/in/ada",
  },
  headline: "Backend engineer",
  summary: "Builds data-heavy systems.",
  skills: ["TypeScript", "Postgres", "React", "Python"],
  experience: [
    {
      company: "Analytical Engines",
      title: "Senior Software Engineer",
      startDate: "2022",
      endDate: "Present",
      description: "Built TypeScript APIs, Postgres data models, and React tools.",
    },
  ],
  education: [
    {
      school: "University of London",
      degree: "BS",
      field: "Mathematics",
      endDate: "2020",
    },
  ],
  github: {
    username: "ada",
    topRepos: [
      {
        name: "compiler-lab",
        description: "TypeScript compiler tooling",
        language: "TypeScript",
        stars: 42,
        url: "https://github.com/ada/compiler-lab",
      },
    ],
  },
  prefs: { roles: [], locations: [] },
  suggestions: [],
  provenance: {},
  log: [],
  updatedAt: "2026-04-25T00:00:00.000Z",
};

const research: JobResearch = {
  jobUrl: "https://example.com/job",
  company: "Example",
  role: "Full Stack Engineer",
  jdSummary: "Build TypeScript and Postgres products.",
  responsibilities: ["Build TypeScript APIs", "Improve Postgres workflows"],
  requirements: ["TypeScript", "Postgres", "React"],
  niceToHaves: [],
  techStack: ["TypeScript", "Postgres", "React"],
  companyMission: "",
  companyProducts: [],
  cultureSignals: [],
  source: "title-only",
  modelDurationMs: 0,
};

function goodResume(): TailoredResume {
  return normalizeResume(
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      links: {
        github: "https://github.com/ada",
        linkedin: "https://linkedin.com/in/ada",
      },
      headline: "Full Stack Engineer",
      summary: "Ignored in strict PDF rendering.",
      skills: ["TypeScript", "Postgres", "React"],
      experience: [
        {
          company: "Analytical Engines",
          title: "Senior Software Engineer",
          startDate: "2022",
          endDate: "Present",
          bullets: [
            "Built TypeScript APIs with Postgres-backed workflows for internal React product teams.",
          ],
        },
      ],
      education: [
        {
          school: "University of London",
          degree: "BS",
          field: "Mathematics",
          endDate: "2020",
        },
      ],
      projects: [
        {
          name: "compiler-lab",
          url: "https://github.com/ada/compiler-lab",
          technologies: ["TypeScript"],
          bullets: ["Built TypeScript compiler tools that map cleanly to developer workflow needs."],
        },
      ],
      coverLetterBlurb: "Ignored in strict PDF rendering.",
      tailoringNotes: {
        matchedKeywords: ["TypeScript", "Postgres", "React"],
        emphasizedExperience: ["Analytical Engines"],
        gaps: [],
        confidence: 90,
      },
    },
    profile
  );
}

const normalized = normalizeResume({ links: {}, tailoringNotes: {} }, profile);
assert.equal(normalized.name, "Ada Lovelace");
assert.equal(normalized.email, "ada@example.com");
assert.equal(normalized.links.github, "https://github.com/ada");
assert.deepEqual(normalized.projects, []);

const fabricated = normalizeResume(
  {
    ...goodResume(),
    experience: [{ company: "Fake Corp", title: "Engineer", bullets: ["Built TypeScript APIs."] }],
    projects: [{ name: "invented-project", bullets: ["Built a project."] }],
  },
  profile
);
const fabricatedQuality = validateResumeQuality(fabricated, profile, research);
assert.equal(fabricatedQuality.hardOk, false);
assert.ok(fabricatedQuality.hardIssues.some((issue) => issue.includes("fabricated_employers")));
assert.ok(fabricatedQuality.hardIssues.some((issue) => issue.includes("fabricated_projects")));

const weak = normalizeResume(
  {
    ...goodResume(),
    skills: ["Kubernetes"],
    experience: [
      {
        company: "Analytical Engines",
        title: "Senior Software Engineer",
        bullets: ["Leveraged synergy.", ""],
      },
    ],
  },
  profile
);
const weakQuality = validateResumeQuality(weak, profile, research);
assert.equal(weakQuality.hardOk, false);
assert.ok(weakQuality.issues.some((issue) => issue.includes("banned_cliches")));
assert.ok(weakQuality.issues.some((issue) => issue.includes("empty_bullets")));
assert.ok(weakQuality.issues.some((issue) => issue.includes("unsupported_skills")));

const html = renderResumeHtml(goodResume());
const experienceIndex = html.indexOf("<h2>Experience</h2>");
const educationIndex = html.indexOf("<h2>Education</h2>");
const skillsIndex = html.indexOf("<h2>Skills</h2>");
const projectsIndex = html.indexOf("<h2>Projects</h2>");
assert.ok(experienceIndex > -1);
assert.ok(educationIndex > experienceIndex);
assert.ok(skillsIndex > educationIndex);
assert.ok(projectsIndex > skillsIndex);
assert.equal(html.includes("<h2>Summary</h2>"), false);
assert.equal(html.includes("<h2>Why this role</h2>"), false);
assert.equal(html.includes("Ignored in strict PDF rendering."), false);

const cleanScore = computeTailoringScore(goodResume(), research).score;
const penalizedScore = computeTailoringScore(
  {
    ...goodResume(),
    tailoringNotes: {
      ...goodResume().tailoringNotes,
      qualityIssues: ["weak_bullets:1", "banned_cliches:leveraged"],
    },
  },
  research
).score;
assert.ok(cleanScore > penalizedScore);
