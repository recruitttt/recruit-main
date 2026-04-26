import { readJson, readParams, routeError } from "../../../../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: { runId: string; jobId: string } | Promise<{ runId: string; jobId: string }> },
): Promise<Response> {
  const { runId, jobId } = await readParams(context);
  const body = await readJson(req);
  if (!body.ok) return body.response;
  const devSkipRealSubmit = isRecord(body.value) && typeof body.value.devSkipRealSubmit === "boolean"
    ? body.value.devSkipRealSubmit
    : undefined;
  try {
    const job = getApplyRunStore().approveJob(runId, jobId, { devSkipRealSubmit });
    if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
    return Response.json({ ok: true, job });
  } catch (error) {
    return routeError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
