import { startRecruit2ApplyRun } from "./recruit2-api";
import { getApplyRunStore } from "./singleton";
import type { NormalizedApplyBatch, ApplyRun } from "./types";

export async function startApplyBatch(batch: NormalizedApplyBatch): Promise<
  | { ok: true; run: ApplyRun; recruit2?: { runId: string; baseUrl: string } }
  | { ok: false; reason: string; status: number }
> {
  const store = getApplyRunStore();
  const run = store.createRun(batch, { source: "mock" });
  const recruit2 = await startRecruit2ApplyRun(batch);
  if (recruit2.ok) {
    store.attachRemoteRun(run.id, recruit2.runId, recruit2.jobs);
    return {
      ok: true,
      run: store.getRun(run.id) ?? run,
      recruit2: { runId: recruit2.runId, baseUrl: recruit2.baseUrl },
    };
  }

  if (recruit2.reason === "missing_recruit2_apply_api_url") {
    seedDevReviewState(run.id, batch);
    return { ok: true, run: store.getRun(run.id) ?? run };
  }

  store.addReviewItems(run.id, run.jobs[0]?.id ?? "run", [
    {
      id: "recruit2-start-error",
      jobId: run.jobs[0]?.id ?? "run",
      label: "Recruit2 engine unavailable",
      value: recruit2.reason,
      kind: "low_confidence",
    },
  ]);
  return { ok: false, reason: recruit2.reason, status: recruit2.status };
}

function seedDevReviewState(runId: string, batch: NormalizedApplyBatch): void {
  const store = getApplyRunStore();
  for (const job of batch.jobs) {
    store.addReviewItems(runId, job.id, [
      {
        id: `${job.id}:profile-fields`,
        jobId: job.id,
        label: "Profile-backed fields",
        value: "Name, email, phone, links, work authorization, and resume are ready for Recruit2.",
        kind: "low_confidence",
      },
    ]);
  }
}
