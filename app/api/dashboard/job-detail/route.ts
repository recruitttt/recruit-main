import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

export async function GET(req: Request) {
  const client = getConvexClient();
  if (!client) {
    return Response.json({ error: "missing_convex_url" }, { status: 503 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ error: "missing_job_id" }, { status: 400 });
  }

  try {
    const detail = await client.query(api.ashby.jobDetail, { jobId: jobId as never });
    if (!detail) {
      return Response.json({ error: "job_not_found" }, { status: 404 });
    }
    return Response.json({ detail });
  } catch (err) {
    const error = err as Error & { cause?: { code?: string; message?: string } };
    const message = [
      error.name,
      error.message,
      error.cause?.code,
      error.cause?.message,
    ].filter(Boolean).join(": ") || "Convex job detail query failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
