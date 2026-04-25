import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { DEMO_PROFILE, isProfileUsable } from "@/lib/demo-profile";
import type { UserProfile } from "@/lib/profile";
import { htmlToPdf, textToPdf, toBase64 } from "@/lib/pdf";
import { pickPageSize, renderResumeHtml } from "@/lib/resume-html";
import { researchJob } from "@/lib/tailor/research";
import { computeTailoringScore } from "@/lib/tailor/score";
import { tailorResume } from "@/lib/tailor/tailor";
import type { Job, TailoredApplication } from "@/lib/tailor/types";

export type PersistedTailorResult =
  | { ok: true; application: TailoredApplication; profileSource: "browser" | "demo" }
  | { ok: false; reason: string; status: number };

type PersistedTailorInput = {
  client: ConvexHttpClient;
  jobId: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
};

export async function tailorPersistedJob({
  client,
  jobId,
  profile: inputProfile,
  pageSize: inputPageSize,
}: PersistedTailorInput): Promise<PersistedTailorResult> {
  const startedAt = Date.now();
  const profile = isProfileUsable(inputProfile) ? inputProfile : DEMO_PROFILE;
  const profileSource = profile === DEMO_PROFILE ? "demo" : "browser";

  if (profileSource === "demo") {
    await client.mutation(api.ashby.upsertDemoProfileSnapshot, {
      profile: DEMO_PROFILE,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "no_api_key", status: 503 };
  }

  const detail = await client.query(api.ashby.jobDetail, { jobId: jobId as never });
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
    jobId: jobId as never,
    status: "tailoring",
    job,
    pdfReady: false,
  });

  try {
    const researched = await researchJob(job, apiKey);
    if (!researched.ok) {
      await markFailed(client, jobId, job, researched.reason);
      return { ok: false, reason: researched.reason, status: 502 };
    }

    const tailored = await tailorResume(profile, researched.research, apiKey);
    if (!tailored.ok) {
      await markFailed(client, jobId, job, tailored.reason);
      return { ok: false, reason: tailored.reason, status: 502 };
    }

    const pageSize = inputPageSize ?? pickPageSize(job.location ?? researched.research.cultureSignals.join(" "));
    const html = renderResumeHtml(tailored.resume, pageSize);
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
      jobId: jobId as never,
      status: "completed",
      job,
      research: researched.research,
      tailoredResume: tailored.resume,
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
    await markFailed(client, jobId, job, reason);
    return { ok: false, reason, status: 502 };
  }
}

async function markFailed(client: ConvexHttpClient, jobId: string, job: Job, error: string) {
  await client.mutation(api.ashby.upsertTailoredApplication, {
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

function resumeFallbackText(resume: {
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    bullets?: string[];
  }>;
  projects?: Array<{
    name?: string;
    bullets?: string[];
  }>;
}): string {
  return [
    "Tailored Resume",
    "",
    resume.summary,
    "",
    resume.skills?.length ? `Skills: ${resume.skills.join(", ")}` : undefined,
    "",
    ...(resume.experience ?? []).flatMap((item) => [
      [item.title, item.company].filter(Boolean).join(" - "),
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    ...(resume.projects ?? []).flatMap((item) => [
      item.name,
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
  ].filter((line): line is string => typeof line === "string").join("\n");
}
