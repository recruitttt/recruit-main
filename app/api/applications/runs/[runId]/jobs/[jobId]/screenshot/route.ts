import { readParams } from "../../../../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";
import { getConvexClient } from "@/lib/convex-http";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: { runId: string; jobId: string } | Promise<{ runId: string; jobId: string }> },
): Promise<Response> {
  const { runId, jobId } = await readParams(context);
  const run = getApplyRunStore().getRun(runId);
  const fallbackConvexJobId = new URL(req.url).searchParams.get("convexJobId")?.trim();
  const job = run?.jobs.find((j) => j.id === jobId) ?? null;
  if (run && !job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (!run && !fallbackConvexJobId) {
    return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  }

  const convexJobId = job?.remoteJobSlug ?? fallbackConvexJobId;
  if (!convexJobId) {
    return Response.json({ ok: false, reason: "no_convex_job_id" }, { status: 409 });
  }

  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  try {
    const screenshot = await client.query(api.applicationJobs.getLatestScreenshot, {
      jobId: convexJobId as never,
    });
    if (!screenshot?.pngBase64) {
      return Response.json(
        { ok: false, reason: "no_screenshot" },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({
      ok: true,
      screenshotPng: screenshot.pngBase64,
      label: screenshot.label,
      createdAt: screenshot.createdAt,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
