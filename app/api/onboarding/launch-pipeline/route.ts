import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { UserProfile } from "@/lib/profile";
import { tailorPersistedJob } from "@/lib/tailor/persisted-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  profile?: UserProfile;
};

type Recommendation = {
  jobId?: string;
  company?: string;
  title?: string;
  rank?: number;
  score?: number;
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

export async function POST(req: Request) {
  const client = getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  if (!body.profile) {
    return Response.json({ ok: false, reason: "missing_profile" }, { status: 400 });
  }

  try {
    await client.mutation(api.ashby.upsertDemoProfileSnapshot, {
      profile: body.profile,
    });

    await client.action(api.ashbyActions.seedAshbySourcesFromCareerOps, {});
    const ingestion = await client.action(api.ashbyActions.runAshbyIngestion, {
      limitSources: 3,
    }) as { runId: Id<"ingestionRuns"> };
    const ranking = await client.action(api.ashbyActions.rankIngestionRun, {
      runId: ingestion.runId,
    });

    const recommendations = await client.query(api.ashby.currentRecommendations, {}) as Recommendation[];
    const topRecommendation = [...recommendations]
      .filter((recommendation) => recommendation.jobId)
      .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))[0];

    if (!topRecommendation?.jobId) {
      return Response.json({
        ok: false,
        reason: "no_ranked_job",
        ingestion,
        ranking,
        recommendationsCount: recommendations.length,
      }, { status: 502 });
    }

    const tailoring = await tailorPersistedJob({
      client,
      jobId: topRecommendation.jobId,
      profile: body.profile,
    });

    if (!tailoring.ok) {
      return Response.json({
        ok: false,
        reason: tailoring.reason,
        ingestion,
        ranking,
        topRecommendation,
      }, { status: tailoring.status });
    }

    return Response.json({
      ok: true,
      ingestion,
      ranking,
      topRecommendation,
      tailoring: {
        jobId: tailoring.application.jobId,
        company: tailoring.application.job.company,
        role: tailoring.application.job.role,
        tailoringScore: tailoring.application.tailoringScore,
        keywordCoverage: tailoring.application.keywordCoverage,
        pdfReady: Boolean(tailoring.application.pdfBase64),
        pdfByteLength: Buffer.from(tailoring.application.pdfBase64, "base64").byteLength,
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
