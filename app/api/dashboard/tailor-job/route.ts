import { getConvexClient } from "@/lib/convex-http";
import type { UserProfile } from "@/lib/profile";
import { tailorPersistedJob } from "@/lib/tailor/persisted-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  jobId?: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
};

export async function POST(req: Request) {
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job" }, { status: 400 });
  }

  const result = await tailorPersistedJob({
    client,
    jobId,
    profile: body.profile,
    pageSize: body.pageSize,
  });
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }

  return Response.json({
    ok: true,
    application: result.application,
    profileSource: result.profileSource,
  });
}
