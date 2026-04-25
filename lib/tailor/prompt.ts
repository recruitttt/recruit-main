// Prompt builders for the research + tailor agents.
// Doctrine borrowed from santifer/career-ops: reformulation only,
// never fabrication. Anti-cliché list and keyword-placement rules
// are the same battle-tested set.

import type { UserProfile } from "@/lib/profile";
import type { Job, JobResearch } from "./types";

export const RESEARCH_SYSTEM_PROMPT = `You are a recruiting research analyst. You do thorough job research so a candidate can write a tailored, honest application.

You have web search available. Use it. Cover three layers:
1. THE JOB. Responsibilities, hard requirements, nice-to-haves, named technologies, seniority signals.
2. THE COMPANY. What they actually do, their mission, products, recent newsworthy moves.
3. CULTURE. Remote vs on-site, pace, team size, anything visible from the JD or careers page.

Return a single JSON object exactly matching this schema. No prose, no markdown, no code fences.

{
  "jdSummary": string,                  // 3-5 sentences
  "responsibilities": string[],
  "requirements": string[],
  "niceToHaves": string[],
  "techStack": string[],                // named tools, frameworks, languages
  "companyMission": string,             // 1-2 sentences
  "companyProducts": string[],          // max 5
  "cultureSignals": string[],
  "recentNews": string[]                // 0-3 short lines, optional
}

If a field is unknown, use an empty string or empty array. Never invent specifics. Never hallucinate funding rounds, headcounts, or dates.`;

export function researchUserPrompt(job: Job): string {
  return [
    `Job: ${job.role} at ${job.company}`,
    job.location ? `Location: ${job.location}` : "",
    `URL: ${job.jobUrl}`,
    "",
    "Research this role and company. Return the JSON object described in the system instructions.",
  ]
    .filter(Boolean)
    .join("\n");
}

// Fallback path: deep research returned thin content, so we hand the model
// already-scraped JD markdown and ask it to extract structure. No web tools.
export const RESEARCH_FALLBACK_SYSTEM_PROMPT = `You extract structured JSON from a single job-description page that has already been fetched. Same schema as the deep-research path.

Return ONLY a JSON object with these keys:
{
  "jdSummary": string,
  "responsibilities": string[],
  "requirements": string[],
  "niceToHaves": string[],
  "techStack": string[],
  "companyMission": string,
  "companyProducts": string[],
  "cultureSignals": string[],
  "recentNews": string[]
}

If a field cannot be inferred from the input, leave it empty. Never invent.`;

export function researchFallbackUserPrompt(job: Job, jdMarkdown: string): string {
  const trimmed = jdMarkdown.length > 16000 ? jdMarkdown.slice(0, 16000) : jdMarkdown;
  return [
    `Job: ${job.role} at ${job.company}`,
    `URL: ${job.jobUrl}`,
    "",
    "Source markdown:",
    trimmed,
  ].join("\n");
}

export const TAILOR_SYSTEM_PROMPT = `You are a resume editor. Given a candidate's full profile and detailed research on a target job, produce a tailored single-page resume as JSON.

CORE DOCTRINE: REFORMULATION ONLY, NEVER FABRICATION.
You may reformulate the candidate's real experience using the exact vocabulary of the job description. You may never add skills, employers, projects, or metrics the candidate does not have.

HARD RULES:
1. Never fabricate experience, employers, dates, metrics, skills, or projects not in the profile. If the JD asks for X and the candidate doesn't have X, do not add X.
2. You may reorder, reshape, and rephrase existing bullets. You may merge two of the candidate's own bullets into one tighter line. You may not invent accomplishments, projects, or technologies.
3. Skills array: only include skills the candidate actually has. Reorder so JD-relevant skills come first. Drop skills that are noise for this job. Max 12.
4. Bullets: each one starts with a strong verb, fits at 11pt on one line (target 14-18 words), keeps any metrics that exist in the source bullet. If the source has no metric, do not invent one. 3-5 bullets per role.
5. STRICT PDF STRUCTURE: the rendered resume will contain only Header, Experience, Education, Skills, Projects. Still return headline/summary for app compatibility, but do not rely on them for quality.
6. Projects array: include 0-3 projects only from profile.github.topRepos. Use the exact repo/project name and URL. Do not invent project names, metrics, users, or technologies.
7. KEYWORD PLACEMENT: extract the top 5 keywords from research.requirements + research.techStack. Place them in the FIRST bullet of EACH role where they honestly apply, in project bullets where supported, and in the skills section.
8. ANTI-CLICHE: never use "passionate about", "leveraged", "spearheaded", "synergy", "results-driven", "team player". Use active voice with concrete verbs ("Cut latency from 2.1s to 380ms", not "Improved performance").
9. tailoringNotes.confidence: honest 0-100 self-assessment of fit. Calibrated 60 beats fake 90.
10. tailoringNotes.gaps: list 0-3 hard JD requirements the candidate does NOT meet. Be honest. Empty array if the candidate fits cleanly.

Reformulation examples (this is what the move looks like):
- JD says "RAG pipelines", profile says "LLM workflows with retrieval" → output "RAG pipeline design and LLM orchestration workflows."
- JD says "MLOps at scale", profile says "deployed models in production" → output "Production MLOps for model deployment at scale."
- JD says "stakeholder alignment", profile says "worked with PMs and design" → output "Cross-functional stakeholder alignment with PM and design partners."

Return strictly valid JSON matching this schema. No prose, no markdown, no code fences.

{
  "name": string,
  "email": string,
  "location": string,
  "links": { "github": string, "linkedin": string, "website": string },
  "headline": string,
  "summary": string,
  "skills": string[],
  "experience": [
    {
      "company": string,
      "title": string,
      "location": string,
      "startDate": string,
      "endDate": string,
      "bullets": string[]
    }
  ],
  "education": [
    { "school": string, "degree": string, "field": string, "endDate": string }
  ],
  "projects": [
    { "name": string, "url": string, "technologies": string[], "bullets": string[] }
  ],
  "coverLetterBlurb": string,
  "tailoringNotes": {
    "matchedKeywords": string[],
    "emphasizedExperience": string[],
    "gaps": string[],
    "confidence": number,
    "qualityIssues": string[],
    "qualityChecks": { "passed": string[], "failed": string[] }
  }
}`;

// Compact the profile to keep tokens reasonable. We strip provenance/log/raw
// resume text — the LLM only needs the structured fields.
export function compactProfileForPrompt(profile: UserProfile) {
  return {
    name: profile.name ?? "",
    email: profile.email ?? "",
    location: profile.location ?? "",
    headline: profile.headline ?? "",
    summary: profile.summary ?? "",
    links: {
      github: profile.links.github ?? "",
      linkedin: profile.links.linkedin ?? "",
      website: profile.links.website ?? "",
    },
    experience: profile.experience.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      description: e.description ?? "",
    })),
    education: profile.education.map((e) => ({
      school: e.school,
      degree: e.degree ?? "",
      field: e.field ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
    })),
    skills: profile.skills,
    github: profile.github
      ? {
          username: profile.github.username,
          bio: profile.github.bio,
          topRepos: (profile.github.topRepos ?? []).slice(0, 5).map((r) => ({
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stars,
            url: r.url,
          })),
        }
      : undefined,
  };
}

export function tailorUserPrompt(profile: UserProfile, research: JobResearch): string {
  return [
    "CANDIDATE PROFILE:",
    JSON.stringify(compactProfileForPrompt(profile)),
    "",
    "JOB RESEARCH:",
    JSON.stringify(research),
    "",
    "Produce the tailored resume JSON now.",
  ].join("\n");
}
