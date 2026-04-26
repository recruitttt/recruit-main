import { startConvexApplyRun } from "./convex-engine";
import { startRecruit2ApplyRun } from "./recruit2-api";
import { getApplyRunStore } from "./singleton";
import type { NormalizedApplyBatch, ApplyRun } from "./types";

export async function startApplyBatch(batch: NormalizedApplyBatch): Promise<
  | { ok: true; run: ApplyRun; recruit2?: { runId: string; baseUrl: string } }
  | { ok: false; reason: string; status: number }
> {
  const store = getApplyRunStore();
  const run = store.createRun(batch, { source: "mock" });
  console.log(`[apply-runtime] run ${run.id} created with ${batch.jobs.length} jobs`);
  const recruit2 = await startRecruit2ApplyRun(batch);
  console.log(`[apply-runtime] recruit2 result: ok=${recruit2.ok} ${recruit2.ok ? "" : `reason=${recruit2.reason}`}`);
  if (recruit2.ok) {
    store.attachRemoteRun(run.id, recruit2.runId, recruit2.jobs);
    return {
      ok: true,
      run: store.getRun(run.id) ?? run,
      recruit2: { runId: recruit2.runId, baseUrl: recruit2.baseUrl },
    };
  }

  if (recruit2.reason === "missing_apply_engine_api_url") {
    console.log(`[apply-runtime] falling through to Convex engine`);
    const convex = await startConvexApplyRun(batch);
    console.log(`[apply-runtime] convex result: ok=${convex.ok} ${convex.ok ? `jobs=${convex.jobs.length}` : `reason=${convex.reason}`}`);
    if (convex.ok) {
      store.attachRemoteRun(
        run.id,
        convex.runId,
        convex.jobs.map((job) => ({ slug: job.jobId, url: job.url })),
        "convex-application-actions",
      );
      return {
        ok: true,
        run: store.getRun(run.id) ?? run,
        recruit2: { runId: convex.runId, baseUrl: "convex-application-actions" },
      };
    }
    store.addReviewItems(run.id, run.jobs[0]?.id ?? "run", [
      {
        id: "convex-start-error",
        jobId: run.jobs[0]?.id ?? "run",
        label: "Application engine unavailable",
        value: convex.reason,
        kind: "low_confidence",
      },
    ]);
    return { ok: false, reason: convex.reason, status: convex.status };
  }

  store.addReviewItems(run.id, run.jobs[0]?.id ?? "run", [
    {
      id: "recruit2-start-error",
      jobId: run.jobs[0]?.id ?? "run",
      label: "Application engine unavailable",
      value: recruit2.reason,
      kind: "low_confidence",
    },
  ]);
  return { ok: false, reason: recruit2.reason, status: recruit2.status };
}
