import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ run: null, recommendations: [] });
  }

  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");
    const demoUserId = url.searchParams.get("demoUserId") ?? undefined;
    const queryArgs = demoUserId ? { demoUserId } : {};
    const [runResult, recommendationsResult, followUpsResult] = await Promise.allSettled([
      client.query(api.ashby.latestIngestionRunSummary, queryArgs),
      client.query(api.ashby.currentRecommendations, queryArgs),
      client.query(api.followups.followUpSummary, {}).then(
        (summary) => ({ ok: true as const, summary }),
        (error) => ({ ok: false as const, error: errorMessage(error) })
      ),
    ]);
    const latestRun = runResult.status === "fulfilled" ? runResult.value : null;
    const run = runId && latestRun?._id !== runId ? null : latestRun;
    const currentRecommendations = recommendationsResult.status === "fulfilled" && Array.isArray(recommendationsResult.value)
      ? recommendationsResult.value
      : [];
    const runRecommendations = runId
      ? currentRecommendations.filter((recommendation: { runId?: string }) => recommendation.runId === runId)
      : currentRecommendations;
    const recommendations = runRecommendations.length > 0
      ? runRecommendations
      : Array.isArray(run?.recommendations)
        ? run.recommendations
        : [];
    const followUps = followUpsResult.status === "fulfilled" ? followUpsResult.value : undefined;
    const logsResult = await Promise.allSettled([
      client.query(api.ashby.latestPipelineLogs, run?._id
        ? { ...queryArgs, runId: run._id, limit: 200 }
        : { ...queryArgs, limit: 200 }),
    ]);
    const logs = logsResult[0].status === "fulfilled" ? logsResult[0].value : [];

    return Response.json({
      run,
      recommendations,
      logs,
      followUps: followUps?.ok ? followUps.summary : emptyFollowUps(),
      followUpsUnavailable: followUps?.ok ? undefined : followUps?.error,
    });
  } catch (err) {
    const message = errorMessage(err) || "Convex dashboard query failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function emptyFollowUps() {
  return {
    applications: [],
    dueTasks: [],
    scheduledTasks: [],
    counts: {
      applications: 0,
      applied: 0,
      due: 0,
      responses: 0,
      interviews: 0,
      rejectedClosed: 0,
    },
  };
}

function errorMessage(err: unknown) {
  const error = err as Error & { cause?: { code?: string; message?: string } };
  return [
    error.name,
    error.message,
    error.cause?.code,
    error.cause?.message,
  ].filter(Boolean).join(": ");
}
