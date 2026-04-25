import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

export async function POST() {
  const client = getConvexClient();
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
