// POST /api/research/job
// Body: { job: Job }
// Response: { ok: true, research: JobResearch } | { ok: false, reason: string }
//
// Calls OpenAI's deep-research-capable model (configured via RESEARCH_MODEL).
// Falls back to Firecrawl + structured extraction if deep research returns
// thin content. Last resort: title-only research using just the company + role.

import { researchJob } from "@/lib/tailor/research";
import type { Job } from "@/lib/tailor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { job?: Job };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const job = body.job;
  if (!job || typeof job.id !== "string" || typeof job.company !== "string" || typeof job.role !== "string") {
    return Response.json({ ok: false, reason: "missing_job_fields" }, { status: 400 });
  }
  if (typeof job.jobUrl !== "string" || job.jobUrl.length === 0) {
    return Response.json({ ok: false, reason: "missing_job_url" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const result = await researchJob(job, apiKey);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  return Response.json({ ok: true, research: result.research });
}
