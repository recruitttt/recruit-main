import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex-http";
import { omDemoLivePayload, shouldUseOmDemoData } from "@/lib/om-demo-data";

export const dynamic = "force-dynamic";

export async function POST() {
  if (shouldUseOmDemoData()) {
    const payload = omDemoLivePayload();
    return Response.json({
      ingestion: {
        runId: payload.run._id,
        sourceCount: payload.run.sourceCount,
        fetchedCount: payload.run.fetchedCount,
        rawJobCount: payload.run.rawJobCount,
        errorCount: payload.run.errorCount,
      },
      ranking: {
        runId: payload.run._id,
        filteredCount: payload.run.filteredCount,
        survivorCount: payload.run.survivorCount,
        llmScoredCount: payload.run.llmScoredCount,
        recommendedCount: payload.run.recommendedCount,
        scoringMode: payload.run.scoringMode,
      },
      rankingWarning: null,
      fixture: payload.fixture,
    });
  }

  const client = await getConvexClient();
  if (!client) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL is not configured." },
      { status: 500 }
    );
  }

  let ingestion: { runId: Id<"ingestionRuns"> };
  try {
    await client.action(api.ashbyActions.seedAshbySourcesFromCareerOps, {});
    ingestion = await client.action(api.ashbyActions.runAshbyIngestion, {
      limitSources: 3,
    }) as { runId: Id<"ingestionRuns"> };
  } catch (err) {
    const message = err instanceof Error && err.message
      ? err.message
      : "Convex ingestion run failed.";
    return Response.json({ error: message, stage: "ingestion" }, { status: 500 });
  }

  try {
    const ranking = await client.action(api.ashbyActions.rankIngestionRun, {
      runId: ingestion.runId,
    });
    return Response.json({ ingestion, ranking, rankingWarning: null });
  } catch (err) {
    const message = err instanceof Error && err.message
      ? err.message
      : "Ranking failed after ingestion completed.";
    return Response.json({
      ingestion,
      ranking: null,
      rankingWarning: message,
    }, { status: 207 });
  }
}
