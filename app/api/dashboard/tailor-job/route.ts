import { track } from "@vercel/analytics/server";
import { getConvexClient } from "@/lib/convex-http";
import { omDemoTailoredApplication, shouldUseOmDemoData } from "@/lib/om-demo-data";
import type { UserProfile } from "@/lib/profile";
import { tailorPersistedJob } from "@/lib/tailor/persisted-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  jobId?: string;
  demoUserId?: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
};

export async function POST(req: Request) {
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

  if (shouldUseOmDemoData()) {
    const tailored = omDemoTailoredApplication(jobId);
    if (!tailored) {
      return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
    }
    await track("tailor_job_completed", { jobId, profileSource: "demo" }).catch(() => {});
    return Response.json({
      ok: true,
      application: tailored.application,
      profileSource: "demo",
    });
  }

  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  const result = await tailorPersistedJob({
    client,
    jobId,
    demoUserId: body.demoUserId,
    profile: body.profile,
    pageSize: body.pageSize,
  });
  if (!result.ok) {
    await track("tailor_job_failed", { jobId, reason: result.reason }).catch(() => {});
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }

  await track("tailor_job_completed", {
    jobId,
    profileSource: result.profileSource ?? "unknown",
  }).catch(() => {});

  return Response.json({
    ok: true,
    application: result.application,
    profileSource: result.profileSource,
  });
}
