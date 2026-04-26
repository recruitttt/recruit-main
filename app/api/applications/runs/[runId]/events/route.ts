import { readParams } from "../../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: { runId: string } | Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await readParams(context);
  getApplyRunStore().advanceLocalRun(runId);
  const run = getApplyRunStore().getRun(runId);
  if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  return Response.json({ ok: true, events: getApplyRunStore().listEvents(runId) });
}
