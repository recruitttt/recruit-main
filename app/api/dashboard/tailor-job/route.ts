import { track } from "@vercel/analytics/server";
import { api } from "@/convex/_generated/api";
import { getSessionUserId } from "@/lib/auth-server";
import { getConvexClient } from "@/lib/convex-http";
import { isProfileUsable } from "@/lib/demo-profile";
import {
  omDemoJobDetail,
  omDemoTailoredApplication,
  shouldUseOmDemoData,
} from "@/lib/om-demo-data";
import type { UserProfile } from "@/lib/profile";
import { isResumeTemplateId, type ResumeTemplateId } from "@/lib/resume-html";
import { tailorDemoJob } from "@/lib/tailor/demo-tailor";
import { tailorPersistedJob } from "@/lib/tailor/persisted-job";
import type { Job } from "@/lib/tailor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  jobId?: string;
  demoUserId?: string;
  profile?: UserProfile;
  pageSize?: "letter" | "a4";
  templateId?: ResumeTemplateId;
};

function pickTemplate(value: unknown): ResumeTemplateId {
  return isResumeTemplateId(value) ? value : "minimalist";
}

async function loadStoredProfile(userId: string | null): Promise<UserProfile | null> {
  if (!userId) return null;
  const client = await getConvexClient();
  if (!client) return null;
  try {
    const row = await client.query(api.userProfiles.byUser, { userId });
    const candidate = (row as { profile?: UserProfile } | null)?.profile;
    return isProfileUsable(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

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

  const templateId = pickTemplate(body.templateId);

  // Resolve the best profile we can find: client-supplied (localStorage) →
  // authenticated convex profile → null. We *only* fall back to the static
  // demo fixture if there's no real profile available anywhere.
  const userId = await getSessionUserId().catch(() => null);
  const browserProfile = isProfileUsable(body.profile) ? body.profile : null;
  const convexProfile = browserProfile ? null : await loadStoredProfile(userId);
  const realProfile: UserProfile | null = browserProfile ?? convexProfile;
  const realProfileSource: "browser" | "convex" | null = browserProfile
    ? "browser"
    : convexProfile
      ? "convex"
      : null;

  if (shouldUseOmDemoData()) {
    // Demo dashboard path. If we have a real profile + AI credentials, run a
    // real research+tailor+render cycle against the demo job. Only fall back
    // to the static fixture PDF when neither a profile nor credentials exist.
    if (realProfile && realProfileSource) {
      const detail = omDemoJobDetail(jobId);
      if (!detail?.job) {
        return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
      }
      const job: Job = {
        id: jobId,
        company: detail.job.company,
        role: detail.job.title,
        jobUrl: detail.job.jobUrl,
        location: detail.job.location,
        descriptionPlain: detail.job.descriptionPlain,
      };
      const tailored = await tailorDemoJob({
        jobId,
        job,
        profile: realProfile,
        profileSource: realProfileSource,
        templateId,
        pageSize: body.pageSize,
      });
      if (tailored.ok) {
        await track("tailor_job_completed", { jobId, profileSource: realProfileSource }).catch(() => {});
        return Response.json({
          ok: true,
          application: tailored.application,
          profileSource: realProfileSource,
        });
      }
      // Real tailoring failed — surface the reason instead of silently
      // returning the misleading demo PDF.
      await track("tailor_job_failed", { jobId, reason: tailored.reason, profileSource: realProfileSource }).catch(() => {});
      return Response.json({ ok: false, reason: tailored.reason }, { status: 502 });
    }

    // No real profile available → fall back to the static demo fixture so the
    // unsigned demo dashboard still has *something* to download.
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

  // Live Convex dashboard. Defer to the canonical persistent flow which
  // pulls the user's profile from Convex, runs research+tailor+render, and
  // writes the PDF back into Convex.
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  const result = await tailorPersistedJob({
    client,
    jobId,
    demoUserId: body.demoUserId,
    profile: realProfile ?? body.profile,
    pageSize: body.pageSize,
    templateId,
    userId: userId ?? undefined,
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
