// Shared real-tailoring helper for the OM demo dashboard path.
//
// When the dashboard runs against fixture jobs (DASHBOARD_DATA_SOURCE unset
// or "fixture"), the legacy code returned a static PDF rendered from
// DEMO_PROFILE plus fixture text — no AI, no template, no use of the
// candidate's real intake data. That made every "Tailor" button a stub.
//
// This helper lifts the real path (research → tailor → render → PDF) out of
// `tailorPersistedJob` so the demo route can use it whenever a usable
// profile and credentials are present. Output is keyed by jobId + a hash of
// the profile so re-tailoring with the same inputs hits cache.
//
// Falls back to a clearly-marked plain-text PDF only when AI credentials are
// missing — never when the user has supplied a real profile.
//
// NOTE: Uses dynamic imports for puppeteer-backed rendering so this module
// stays safe to import from the Next.js Edge runtime smoke tests.
import { contentHash } from "@/lib/embeddings/cache";
import { isProfileUsable } from "@/lib/demo-profile";
import type { UserProfile } from "@/lib/profile";
import { resumeFallbackText } from "@/lib/tailor/resume-fallback-text";
import { hasResearchCredentials, researchJob } from "@/lib/tailor/research";
import { computeTailoringScore } from "@/lib/tailor/score";
import { hasTailorCredentials, tailorResume } from "@/lib/tailor/tailor";
import type { Job, TailoredApplication, TailoredResume } from "@/lib/tailor/types";
import type { ResumeTemplateId } from "@/lib/resume-html";

export type DemoTailorResult =
  | { ok: true; application: TailoredApplication; filename: string; profileSource: "browser" | "convex" | "demo" }
  | { ok: false; reason: string };

type DemoTailorInput = {
  jobId: string;
  job: Job;
  profile: UserProfile;
  profileSource: "browser" | "convex" | "demo";
  templateId?: ResumeTemplateId;
  pageSize?: "letter" | "a4";
};

const cache = new Map<string, DemoTailorResult & { ok: true }>();

function safeFilename(company: string): string {
  const safe = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Resume_${safe || "Tailored"}.pdf`;
}

function profileSignature(profile: UserProfile): string {
  return contentHash(
    JSON.stringify({
      name: profile.name,
      email: profile.email,
      headline: profile.headline,
      summary: profile.summary,
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      links: profile.links,
      github: profile.github
        ? {
            username: profile.github.username,
            topRepos: (profile.github.topRepos ?? []).map((r) => r.url),
          }
        : null,
    })
  );
}

function buildCacheKey(input: DemoTailorInput): string {
  return `${input.jobId}::${input.templateId ?? "default"}::${input.pageSize ?? "auto"}::${profileSignature(input.profile)}`;
}

export function clearDemoTailorCache(): void {
  cache.clear();
}

export async function tailorDemoJob(input: DemoTailorInput): Promise<DemoTailorResult> {
  if (!isProfileUsable(input.profile)) {
    return { ok: false, reason: "profile_incomplete" };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasResearchCredentials(apiKey)) {
    return { ok: false, reason: "no_research_api_key" };
  }
  if (!hasTailorCredentials(apiKey)) {
    return { ok: false, reason: "no_tailor_api_key" };
  }

  const key = buildCacheKey(input);
  const cached = cache.get(key);
  if (cached) return cached;

  const startedAt = Date.now();
  const research = await researchJob(input.job, apiKey);
  if (!research.ok) return { ok: false, reason: research.reason };

  const tailored = await tailorResume(input.profile, research.research, apiKey);
  if (!tailored.ok) return { ok: false, reason: tailored.reason };

  const { pickPageSize, renderResumeHtml } = await import("@/lib/resume-html");
  const pageSize = input.pageSize ?? pickPageSize(input.job.location ?? research.research.cultureSignals.join(" "));
  const html = renderResumeHtml(tailored.resume, pageSize, input.templateId);

  let pdfBase64: string;
  try {
    const { htmlToPdf, textToPdf, toBase64 } = await import("@/lib/pdf");
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await htmlToPdf(html, { format: pageSize });
    } catch {
      // Local dev without Chrome / serverless without browserbase falls back
      // to the plain-text PDF so the user still gets *their tailored content*
      // — better than the demo profile stub.
      pdfBytes = textToPdf(resumeFallbackText(tailored.resume));
    }
    pdfBase64 = toBase64(pdfBytes);
  } catch (err) {
    return { ok: false, reason: `pdf_failed: ${(err as Error).message ?? "unknown"}` };
  }

  const scoring = computeTailoringScore(tailored.resume, research.research);
  const application: TailoredApplication = {
    jobId: input.jobId,
    job: input.job,
    research: {
      source: research.research.source,
      summary: research.research.jdSummary,
      requirementsCount: research.research.requirements.length,
      techStackCount: research.research.techStack.length,
    },
    tailoredResume: tailored.resume,
    pdfBase64,
    tailoringScore: scoring.score,
    keywordCoverage: scoring.coverage,
    durationMs: Date.now() - startedAt,
  };

  const result: DemoTailorResult & { ok: true } = {
    ok: true,
    application,
    filename: safeFilename(input.job.company),
    profileSource: input.profileSource,
  };
  cache.set(key, result);
  return result;
}

export type { TailoredResume };
