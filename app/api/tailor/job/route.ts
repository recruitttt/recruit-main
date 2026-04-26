// POST /api/tailor/job
// Body: { profile: UserProfile, research: JobResearch, job: Job, pageSize?: "letter" | "a4" }
// Response: { ok: true, application: TailoredApplication } | { ok: false, reason }
//
// Runs the tailor LLM call, validates against fabrication, renders the React
// resume template to HTML, prints to PDF via Puppeteer, computes the scoring
// triad, returns base64 PDF + structured tailoring metadata.

import type { UserProfile } from "@/lib/profile";
import { htmlToPdf, toBase64 } from "@/lib/pdf";
import { pickPageSize, renderResumeHtml } from "@/lib/resume-html";
import { computeTailoringScore } from "@/lib/tailor/score";
import { hasTailorCredentials, tailorResume } from "@/lib/tailor/tailor";
import type { Job, JobResearch, TailoredApplication } from "@/lib/tailor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  profile?: UserProfile;
  research?: JobResearch;
  job?: Job;
  pageSize?: "letter" | "a4";
};

export async function POST(req: Request) {
  const startedAt = Date.now();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { profile, research, job } = body;
  if (!profile || !research || !job) {
    return Response.json(
      { ok: false, reason: "missing_profile_or_research_or_job" },
      { status: 400 }
    );
  }

  if (!profile.experience || profile.experience.length === 0) {
    return Response.json({ ok: false, reason: "profile_incomplete" }, { status: 400 });
  }

  if (!hasTailorCredentials()) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const tailored = await tailorResume(profile, research);
  if (!tailored.ok) {
    return Response.json({ ok: false, reason: tailored.reason }, { status: 502 });
  }

  const pageSize = body.pageSize ?? pickPageSize(job.location ?? research.cultureSignals.join(" "));
  const html = renderResumeHtml(tailored.resume, pageSize);

  let pdfBase64: string;
  try {
    const pdfBytes = await htmlToPdf(html, { format: pageSize });
    pdfBase64 = toBase64(pdfBytes);
  } catch (err) {
    return Response.json(
      { ok: false, reason: `pdf_failed: ${(err as Error).message ?? "unknown"}` },
      { status: 502 }
    );
  }

  const scoring = computeTailoringScore(tailored.resume, research);

  const application: TailoredApplication = {
    jobId: job.id,
    job,
    research: {
      source: research.source,
      summary: research.jdSummary,
      requirementsCount: research.requirements.length,
      techStackCount: research.techStack.length,
    },
    tailoredResume: tailored.resume,
    pdfBase64,
    tailoringScore: scoring.score,
    keywordCoverage: scoring.coverage,
    durationMs: Date.now() - startedAt,
  };

  return Response.json({ ok: true, application });
}
