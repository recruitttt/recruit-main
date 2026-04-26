import { readParams, routeError } from "../../../../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: { runId: string; jobId: string } | Promise<{ runId: string; jobId: string }> },
): Promise<Response> {
  const { runId, jobId } = await readParams(context);
  try {
    const job = getApplyRunStore().cancelJob(runId, jobId);
    if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
    return Response.json({ ok: true, job });
  } catch (error) {
    return routeError(error);
  }
}
