// Onboarding launch-pipeline route.
//
// Boots the job-search / resume-tailoring pipeline with the freshest
// `UserProfile` we can assemble from every Convex intake source. The client
// no longer ships its localStorage cache here — we read all data straight
// from Convex (where the GitHub/LinkedIn/Resume adapters write):
//
//   1. Resolve the better-auth session → userId.        (401 on miss)
//   2. Inspect intake state via `api.intakeRuns.summary`.
//      If any kind is still `running` and `force !== true`, return 409.
//   3. Assemble the merged profile via `api.userProfiles.assembleForPipeline`.
//   4. Hand it to the existing `ashby:startOnboardingPipeline` mutation.
//   5. Reply with `{ ok, runId, status, message, used }` — `used` flags
//      which sources made it in so the UI can surface a confirmation.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md (this
// route was the missing seam between intake adapters and Ashby).

import { makeFunctionReference } from "convex/server";

import { api } from "@/convex/_generated/api";
import { getSessionUserId } from "@/lib/auth-server";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

interface LaunchBody {
  force?: boolean;
  runConfig?: {
    limitSources?: number;
    tailorLimit?: number;
  };
}

interface IntakeSummaryEntry {
  kind: "github" | "linkedin" | "resume" | "web" | "chat" | "ai-report";
  status: "pending" | "running" | "completed" | "failed" | "none";
}

interface AssembledPipelinePayload {
  profile: Record<string, unknown>;
  sources: {
    userProfile: boolean;
    github: boolean;
    linkedin: boolean;
    resume: boolean;
    repoSummaryCount: number;
    experienceSummaryCount: number;
  };
}

const startOnboardingPipeline = makeFunctionReference<"mutation">(
  "ashby:startOnboardingPipeline",
);

function jsonError(reason: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, reason, ...(extra ?? {}) }, { status });
}

export async function POST(req: Request) {
  // ---- 1. Auth ----------------------------------------------------------
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  // ---- 2. Convex client -------------------------------------------------
  const client = await getConvexClient();
  if (!client) return jsonError("missing_convex_url", 503);

  // ---- 3. Body (force flag + optional run config) -----------------------
  let body: LaunchBody = {};
  if (req.headers.get("content-length") !== "0") {
    try {
      const raw = await req.text();
      if (raw.trim().length > 0) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") {
          body = parsed as LaunchBody;
        }
      }
    } catch {
      return jsonError("bad_request", 400);
    }
  }
  const force = body.force === true;
  const limitSources = body.runConfig?.limitSources ?? 3;
  const tailorLimit = body.runConfig?.tailorLimit ?? 3;

  // ---- 4. Intake gate: refuse if anything is still running --------------
  let intakeSummary: IntakeSummaryEntry[];
  try {
    intakeSummary = (await client.query(api.intakeRuns.summary, {
      userId,
    })) as IntakeSummaryEntry[];
  } catch (err) {
    // Auth / convex error — surface but don't crash the pipeline call.
    return jsonError(
      err instanceof Error ? err.message : "intake_summary_failed",
      500,
    );
  }
  const running = intakeSummary
    .filter((row) => row.status === "running")
    .map((row) => row.kind);
  if (running.length > 0 && !force) {
    return Response.json(
      { ok: false, reason: "intake_in_progress", running },
      { status: 409 },
    );
  }

  // ---- 5. Assemble the merged profile ----------------------------------
  let assembled: AssembledPipelinePayload | null;
  try {
    assembled = (await client.query(api.userProfiles.assembleForPipeline, {
      userId,
    })) as AssembledPipelinePayload | null;
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "assemble_failed",
      500,
    );
  }

  // No profile data anywhere — let the caller decide whether to redirect
  // back to onboarding. We do NOT silently start the pipeline against an
  // empty profile (that would burn LLM tokens for nothing).
  if (!assembled) {
    return jsonError("no_profile_data", 409, {
      hint: "complete at least one intake source before launching the pipeline",
    });
  }

  // ---- 6. Kick off the Ashby pipeline ----------------------------------
  try {
    const started = (await client.mutation(startOnboardingPipeline, {
      // The mutation derives demoUserId from the better-auth identity when
      // unspecified (`auth:${subject}`), but we forward it explicitly so the
      // demoUserId always matches the userId the launch route resolved.
      demoUserId: `auth:${userId}`,
      profile: assembled.profile,
      limitSources,
      tailorLimit,
    })) as { runId: string; status: "started"; message: string };

    return Response.json({
      ok: true,
      runId: started.runId,
      status: started.status,
      message: started.message,
      used: {
        userProfile: assembled.sources.userProfile,
        github: assembled.sources.github,
        linkedin: assembled.sources.linkedin,
        resume: assembled.sources.resume,
        repoSummaryCount: assembled.sources.repoSummaryCount,
        experienceSummaryCount: assembled.sources.experienceSummaryCount,
      },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : String(err),
      500,
    );
  }
}
