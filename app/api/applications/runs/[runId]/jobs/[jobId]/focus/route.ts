import { readJson, readParams } from "../../../../../_route-utils";
import { getApplyRunStore, recruit2ApplyApiBaseUrl } from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: { runId: string; jobId: string } | Promise<{ runId: string; jobId: string }> },
): Promise<Response> {
  const { runId, jobId } = await readParams(context);
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;

  const run = getApplyRunStore().getRun(runId);
  if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  const job = run.jobs.find((item) => item.id === jobId);
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (!job.remoteRunId || !job.remoteJobSlug) {
    return Response.json({ ok: false, reason: "remote_job_not_ready" }, { status: 409 });
  }

  const baseUrl = recruit2ApplyApiBaseUrl();
  if (!baseUrl) return Response.json({ ok: false, reason: "missing_apply_engine_api_url" }, { status: 503 });

  const upstream = await fetch(
    `${baseUrl}/api/apply-lab/runs/${encodeURIComponent(job.remoteRunId)}/jobs/${encodeURIComponent(job.remoteJobSlug)}/focus`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.value),
      cache: "no-store",
    },
  );
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}
