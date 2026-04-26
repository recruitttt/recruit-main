import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { DEMO_PROFILE, isProfileUsable } from "@/lib/demo-profile";
import type { UserProfile } from "@/lib/profile";
import { htmlToPdf, textToPdf, toBase64 } from "@/lib/pdf";
import { isResumeTemplateId, pickPageSize, renderResumeHtml, type ResumeTemplateId } from "@/lib/resume-html";
import { resumeFallbackText } from "@/lib/tailor/resume-fallback-text";
import { hasResearchCredentials, researchJob } from "@/lib/tailor/research";
import { computeTailoringScore } from "@/lib/tailor/score";
import { hasTailorCredentials, tailorResume } from "@/lib/tailor/tailor";
import type { Job, TailoredApplication } from "@/lib/tailor/types";

export type PersistedTailorResult =
  | { ok: true; application: TailoredApplication; profileSource: "browser" | "convex" | "demo" }
  | { ok: false; reason: string; status: number };

type PersistedTailorInput = {
  client: ConvexHttpClient;
  jobId: string;
  demoUserId?: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
  templateId?: ResumeTemplateId;
  userId?: string;
};

async function loadConvexProfile(
  client: ConvexHttpClient,
  userId: string | undefined,
  demoUserId: string | undefined
): Promise<UserProfile | undefined> {
  // Authenticated users keep their canonical profile in `userProfiles`.
  // The legacy `demoProfiles` table is only populated when an unsigned
  // demo run uploads a profile snapshot. Prefer the real one.
  if (userId) {
    try {
      const row = (await client.query(api.userProfiles.byUser, { userId })) as
        | { profile?: UserProfile }
        | null;
      if (isProfileUsable(row?.profile)) return row?.profile;
    } catch {
      // requireOwner mismatch / unauthenticated — fall through to demo lookup
    }
  }
  try {
    const ctx = await client.query(api.ashby.getAshbyRuntimeProfileContext, {
      ...(demoUserId ? { demoUserId } : {}),
    });
    const candidate = (ctx as { profile?: UserProfile } | null)?.profile;
    return isProfileUsable(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export async function tailorPersistedJob({
  client,
  jobId,
  demoUserId,
  profile: inputProfile,
  pageSize: inputPageSize,
  templateId: inputTemplateId,
  userId,
}: PersistedTailorInput): Promise<PersistedTailorResult> {
  const startedAt = Date.now();
  const storedProfile = isProfileUsable(inputProfile)
    ? undefined
    : await loadConvexProfile(client, userId, demoUserId);
  const profile = isProfileUsable(inputProfile)
    ? inputProfile
    : storedProfile ?? DEMO_PROFILE;
  const profileSource = isProfileUsable(inputProfile)
    ? "browser"
    : storedProfile
      ? "convex"
      : "demo";
  const templateId: ResumeTemplateId = isResumeTemplateId(inputTemplateId)
    ? inputTemplateId
    : "minimalist";

  if (profileSource === "demo") {
    await client.mutation(api.ashby.upsertDemoProfileSnapshot, {
      ...(demoUserId ? { demoUserId } : {}),
      profile: DEMO_PROFILE,
    });
  }

  const researchApiKey = process.env.OPENAI_API_KEY;
  if (!hasResearchCredentials(researchApiKey)) {
    return { ok: false, reason: "no_research_api_key", status: 503 };
  }
  if (!hasTailorCredentials(researchApiKey)) {
    return { ok: false, reason: "no_tailor_api_key", status: 503 };
  }

  const detail = await client.query(api.ashby.jobDetail, {
    jobId: jobId as never,
    ...(demoUserId ? { demoUserId } : {}),
  });
  const sourceJob = detail?.job;
  if (!sourceJob) {
    return { ok: false, reason: "job_not_found", status: 404 };
  }

  const job: Job = {
    id: jobId,
    company: sourceJob.company,
    role: sourceJob.title,
    jobUrl: sourceJob.jobUrl,
    location: sourceJob.location,
    descriptionPlain: sourceJob.descriptionPlain,
  };

  await client.mutation(api.ashby.upsertTailoredApplication, {
    ...(demoUserId ? { demoUserId } : {}),
    jobId: jobId as never,
    status: "tailoring",
    job,
    pdfReady: false,
  });

  try {
    const researched = await researchJob(job, researchApiKey);
    if (!researched.ok) {
      await markFailed(client, jobId, job, researched.reason, demoUserId);
      return { ok: false, reason: researched.reason, status: 502 };
    }

    const tailored = await tailorResume(profile, researched.research, researchApiKey);
    if (!tailored.ok) {
      await markFailed(client, jobId, job, tailored.reason, demoUserId);
      return { ok: false, reason: tailored.reason, status: 502 };
    }

    const pageSize = inputPageSize ?? pickPageSize(job.location ?? researched.research.cultureSignals.join(" "));
    const html = renderResumeHtml(tailored.resume, pageSize, templateId);
    const pdfBytes = await htmlToPdf(html, { format: pageSize }).catch(() =>
      textToPdf(resumeFallbackText(tailored.resume))
    );
    const pdfBase64 = toBase64(pdfBytes);
    const scoring = computeTailoringScore(tailored.resume, researched.research);
    const pdfFilename = pdfName(job.company);

    const application: TailoredApplication = {
      jobId,
      job,
      research: {
        source: researched.research.source,
        summary: researched.research.jdSummary,
        requirementsCount: researched.research.requirements.length,
        techStackCount: researched.research.techStack.length,
      },
      tailoredResume: tailored.resume,
      pdfBase64,
      tailoringScore: scoring.score,
      keywordCoverage: scoring.coverage,
      durationMs: Date.now() - startedAt,
    };

    await client.mutation(api.ashby.upsertTailoredApplication, {
      ...(demoUserId ? { demoUserId } : {}),
      jobId: jobId as never,
      status: "completed",
      job,
      research: researched.research,
      tailoredResume: tailored.resume,
      templateId,
      tailoringScore: scoring.score,
      keywordCoverage: scoring.coverage,
      durationMs: application.durationMs,
      pdfReady: true,
      pdfFilename,
      pdfByteLength: pdfBytes.byteLength,
      pdfBase64,
    });

    return { ok: true, application, profileSource };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await markFailed(client, jobId, job, reason, demoUserId);
    return { ok: false, reason, status: 502 };
  }
}

async function markFailed(
  client: ConvexHttpClient,
  jobId: string,
  job: Job,
  error: string,
  demoUserId?: string
) {
  await client.mutation(api.ashby.upsertTailoredApplication, {
    ...(demoUserId ? { demoUserId } : {}),
    jobId: jobId as never,
    status: "failed",
    job,
    pdfReady: false,
    error,
  });
}

function pdfName(company: string): string {
  const safeCompany = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Resume_${safeCompany || "Tailored"}.pdf`;
}
