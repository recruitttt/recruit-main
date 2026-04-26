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

  if (run) {
    // Store is available (same serverless instance that created the run).
    // Merge Convex job status into it for Convex-engine runs.
    if (run.source === "convex-application-actions") {
      await syncConvexJobStatuses(store, run, runId);
    }
    return Response.json({ ok: true, run: store.getRun(runId) ?? run });
  }

  // Store miss — Vercel serverless cold-start or different instance.
  // Return 200 with ok:true but no run payload so the frontend keeps its
  // existing state. The screenshot poller uses convexJobId and doesn't
  // depend on the store, so live updates still flow.
  return Response.json({ ok: true, run: null });
}

async function syncConvexJobStatuses(
  store: ReturnType<typeof getApplyRunStore>,
  run: NonNullable<ReturnType<ReturnType<typeof getApplyRunStore>["getRun"]>>,
  runId: string,
): Promise<void> {
  const client = await getConvexClient().catch(() => null);
  if (!client) return;

  for (const job of run.jobs) {
    if (!job.remoteJobSlug) continue;
    try {
      const convexJob = await client.query(
        api.applicationJobs.getApplicationJob,
        { jobId: job.remoteJobSlug as never },
      ) as { status?: string; error?: string } | null;
      if (convexJob?.status && typeof store.patchJobStatus === "function") {
        store.patchJobStatus(runId, job.id, convexJob.status, convexJob.error);
      }
    } catch {
      // Convex query failed — return stale status
    }
  }
}
