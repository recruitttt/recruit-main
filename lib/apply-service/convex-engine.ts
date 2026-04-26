import { convexRefs } from "../convex-refs";
import { getConvexClient } from "../convex-http";
import { detectProviderFromUrl } from "../form-engine/ashby-adapter";
import type { NormalizedApplyBatch } from "./types";

export type ConvexApplyEngineStartResult =
  | {
      ok: true;
      runId: string;
      jobs: Array<{
        jobId: string;
        localJobId: string;
        scheduled: boolean;
        url: string;
      }>;
    }
  | {
      ok: false;
      reason: string;
      status: number;
    };

export async function startConvexApplyRun(
  batch: NormalizedApplyBatch,
  options: {
    client?: Awaited<ReturnType<typeof getConvexClient>>;
  } = {},
): Promise<ConvexApplyEngineStartResult> {
  const client = options.client ?? await getConvexClient();
  if (!client) {
    return {
      ok: false,
      reason: "missing_apply_engine_api_url_and_convex_url",
      status: 503,
    };
  }

  try {
    console.log(`[convex-engine] creating ${batch.jobs.length} application jobs`);
    const jobs = await Promise.all(
      batch.jobs.map(async (job) => {
        const targetUrl = job.applicationUrl ?? job.url;
        console.log(`[convex-engine] scheduling job: ${job.company} → ${targetUrl}`);
        const result = await client.mutation(convexRefs.applicationJobs.createAndScheduleApplicationJob, {
          targetUrl,
          providerHint: detectProviderFromUrl(targetUrl),
          company: job.company,
          title: job.title,
          submitPolicy: batch.settings.devSkipRealSubmit || !batch.consent.finalSubmitApproved ? "dry_run" : "submit",
          engine: "ai-fill",
          llmMode: "best_effort",
          repairLimit: 1,
        });
        const scheduled = result as {
          jobId: string;
          scheduled: boolean;
        };
        return {
          jobId: scheduled.jobId,
          localJobId: job.id,
          scheduled: scheduled.scheduled,
          url: targetUrl,
        };
      }),
    );

    console.log(`[convex-engine] all ${jobs.length} jobs scheduled: ${jobs.map((j) => j.jobId).join(", ")}`);
    return {
      ok: true,
      runId: `convex-${jobs.map((job) => job.jobId).join("-")}`,
      jobs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[convex-engine] FAILED:`, message);
    return {
      ok: false,
      reason: `convex_apply_engine_unavailable: ${message}`,
      status: 503,
    };
  }
}
