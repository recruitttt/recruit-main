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
  // If this is a Convex-engine run (id starts with "run_"), try to
  // reconstruct minimal status from Convex so the frontend doesn't 404.
  const client = await getConvexClient().catch(() => null);
  if (!client) {
    return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  }

  // The remoteRunId for Convex runs is "convex-<jobId1>-<jobId2>-...".
  // We don't have the mapping, but the frontend also polls /job?action=screenshot
  // which works via convexJobId. Return a thin shell so the frontend doesn't
  // break its polling loop.
  return Response.json({
    ok: true,
    run: {
      id: runId,
      status: "filling",
      source: "convex-application-actions",
      jobs: [],
      settings: { mode: "auto-strict", maxApplicationsPerRun: 20, maxConcurrentApplications: 10, maxConcurrentPerDomain: 20, computerUseModel: "gpt-5.4-nano", devSkipRealSubmit: true },
      questionGroups: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
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
