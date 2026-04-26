import { readJson } from "../../_route-utils";
import { normalizeApplyBatchRequest } from "@/lib/apply-service";
import { startApplyBatch } from "@/lib/apply-service/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body.ok) return body.response;

  const normalized = normalizeApplyBatchRequest(body.value);
  if (!normalized.ok) {
    return Response.json(
      {
        ok: false,
        reason: normalized.reason,
        ...(normalized.maxApplicationsPerRun !== undefined
          ? { maxApplicationsPerRun: normalized.maxApplicationsPerRun }
          : {}),
      },
      { status: normalized.status },
    );
  }

  const started = await startApplyBatch(normalized.value);
  if (!started.ok) {
    return Response.json({ ok: false, reason: started.reason }, { status: started.status });
  }

  return Response.json({
    ok: true,
    run: started.run,
    recruit2: started.recruit2 ?? null,
  });
}
