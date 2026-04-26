import { readParams } from "../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";
import { getConvexClient } from "@/lib/convex-http";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: { runId: string } | Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await readParams(context);
  const store = getApplyRunStore();
  const run = store.getRun(runId);
  if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });

  // For Convex-engine runs, merge the actual Convex job status back into
  // the in-memory store so the frontend sees status transitions.
  if (run.source === "convex-application-actions") {
    const client = await getConvexClient().catch((err) => { console.error("[run-poll] getConvexClient failed:", err); return null; });
    if (client) {
      let updated = false;
      for (const job of run.jobs) {
        if (!job.remoteJobSlug) continue;
        try {
          const convexJob = await client.query(
            api.applicationJobs.getApplicationJob,
            { jobId: job.remoteJobSlug as never }
          ) as { status?: string; error?: string; lastCheckpoint?: string } | null;
          if (convexJob?.status && typeof store.patchJobStatus === "function") {
            store.patchJobStatus(runId, job.id, convexJob.status, convexJob.error);
            updated = true;
          }
        } catch (err) {
          console.error("[run-poll] convex query failed:", err instanceof Error ? err.message : err);
        }
      }
      if (updated) {
        const freshRun = store.getRun(runId);
        if (freshRun) return Response.json({ ok: true, run: freshRun });
      }
    }
  }

  return Response.json({ ok: true, run });
}
