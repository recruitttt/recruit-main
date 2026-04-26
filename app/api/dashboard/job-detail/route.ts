import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const demoUserId = url.searchParams.get("demoUserId") ?? undefined;
  if (!jobId) {
    return Response.json({ error: "missing_job_id" }, { status: 400 });
  }

  const client = await getConvexClient();
  if (!client) {
    return Response.json({ error: "missing_convex_url" }, { status: 503 });
  }

  try {
    const detail = await client.query(api.ashby.jobDetail, {
      jobId: jobId as never,
      ...(demoUserId ? { demoUserId } : {}),
    });
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
