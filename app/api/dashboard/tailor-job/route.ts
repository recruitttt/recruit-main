import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { DEMO_PROFILE, isProfileUsable } from "@/lib/demo-profile";
import type { UserProfile } from "@/lib/profile";
import { htmlToPdf, toBase64 } from "@/lib/pdf";
import { pickPageSize, renderResumeHtml } from "@/lib/resume-html";
import { computeTailoringScore } from "@/lib/tailor/score";
import { researchJob } from "@/lib/tailor/research";
import { tailorResume } from "@/lib/tailor/tailor";
import type { Job, TailoredApplication } from "@/lib/tailor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  jobId?: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const client = getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job" }, { status: 400 });
  }
  const profile = isProfileUsable(body.profile) ? body.profile : DEMO_PROFILE;
  const profileSource = profile === DEMO_PROFILE ? "demo" : "browser";

  if (profileSource === "demo") {
    await client.mutation(api.ashby.upsertDemoProfileSnapshot, {
      profile: DEMO_PROFILE,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const detail = await client.query(api.ashby.jobDetail, { jobId: jobId as never });
  const sourceJob = detail?.job;
  if (!sourceJob) {
    return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
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
      return Response.json({ ok: false, reason: researched.reason }, { status: 502 });
    }

    const tailored = await tailorResume(profile, researched.research, apiKey);
    if (!tailored.ok) {
      await markFailed(client, jobId, job, tailored.reason);
      return Response.json({ ok: false, reason: tailored.reason }, { status: 502 });
    }

    const pageSize = body.pageSize ?? pickPageSize(job.location ?? researched.research.cultureSignals.join(" "));
    const html = renderResumeHtml(tailored.resume, pageSize);
    const pdfBytes = await htmlToPdf(html, { format: pageSize });
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
    });

    return Response.json({ ok: true, application, profileSource });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await markFailed(client, jobId, job, reason);
    return Response.json({ ok: false, reason }, { status: 502 });
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
