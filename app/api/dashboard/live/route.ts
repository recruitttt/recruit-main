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
    const [run, recommendations] = await Promise.all([
      client.query(api.ashby.latestIngestionRunSummary, {}),
      client.query(api.ashby.currentRecommendations, {}),
    ]);

    return Response.json({ run, recommendations });
  } catch (err) {
    const error = err as Error & { cause?: { code?: string; message?: string } };
    const message = [
      error.name,
      error.message,
      error.cause?.code,
      error.cause?.message,
    ].filter(Boolean).join(": ") || "Convex dashboard query failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
