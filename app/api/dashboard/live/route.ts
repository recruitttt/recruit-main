import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

export async function GET() {
  const client = getConvexClient();
  if (!client) {
    return Response.json({ run: null, recommendations: [] });
  }

  try {
    const [run, recommendations, followUpsResult] = await Promise.all([
      client.query(api.ashby.latestIngestionRunSummary, {}),
      client.query(api.ashby.currentRecommendations, {}),
      client.query(api.followups.followUpSummary, {}).then(
        (summary) => ({ ok: true as const, summary }),
        (error) => ({ ok: false as const, error: errorMessage(error) })
      ),
    ]);
    const logs = await client.query(api.ashby.latestPipelineLogs, run?._id
      ? { runId: run._id, limit: 200 }
      : { limit: 200 });

    return Response.json({
      run,
      recommendations,
      logs,
      followUps: followUpsResult.ok ? followUpsResult.summary : emptyFollowUps(),
      followUpsUnavailable: followUpsResult.ok ? undefined : followUpsResult.error,
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
