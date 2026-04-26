import { readParams } from "../../../../_route-utils";
import { getApplyRunStore, recruit2ApplyApiBaseUrl } from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: { runId: string } | Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await readParams(context);
  const run = getApplyRunStore().getRun(runId);
  if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  if (!run.remoteRunId) return Response.json({ ok: false, reason: "remote_run_not_ready" }, { status: 409 });

  const baseUrl = recruit2ApplyApiBaseUrl();
  if (!baseUrl) return Response.json({ ok: false, reason: "missing_apply_engine_api_url" }, { status: 503 });

  const upstream = await fetch(`${baseUrl}/api/apply-lab/runs/${encodeURIComponent(run.remoteRunId)}/events`, {
    headers: { Accept: "text/event-stream" },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { ok: false, reason: `recruit2_events_${upstream.status}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
