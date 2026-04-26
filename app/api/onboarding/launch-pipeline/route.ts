// Onboarding launch-pipeline route.
//
// Normal users launch from Convex intake state assembled by the profile
// adapters. Production smoke tests may also pass an explicit test profile
// payload so the E2E runner can verify the pipeline without depending on
// browser-local onboarding state.

import { makeFunctionReference } from "convex/server";

import { api } from "@/convex/_generated/api";
import { getSessionUserId } from "@/lib/auth-server";
import { getConvexClient } from "@/lib/convex-http";
import type { UserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

interface LaunchBody {
  force?: boolean;
  profile?: UserProfile;
  limitSources?: number;
  tailorLimit?: number;
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
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  const client = await getConvexClient();
  if (!client) return jsonError("missing_convex_url", 503);

  let body: LaunchBody = {};
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

  const limitSources = parseOptionalPositiveInteger(
    body.runConfig?.limitSources ?? body.limitSources,
    1,
    10,
  );
  const tailorLimit = parseOptionalPositiveInteger(
    body.runConfig?.tailorLimit ?? body.tailorLimit,
    1,
    10,
  );
  if (!limitSources.ok) return jsonError("invalid_limit_sources", 400);
  if (!tailorLimit.ok) return jsonError("invalid_tailor_limit", 400);

  let intakeSummary: IntakeSummaryEntry[];
  try {
    intakeSummary = (await client.query(api.intakeRuns.summary, {
      userId,
    })) as IntakeSummaryEntry[];
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "intake_summary_failed",
      500,
    );
  }

  const running = intakeSummary
    .filter((row) => row.status === "running")
    .map((row) => row.kind);
  if (running.length > 0 && body.force !== true) {
    return Response.json(
      { ok: false, reason: "intake_in_progress", running },
      { status: 409 },
    );
  }

  const suppliedProfile = body.profile && typeof body.profile === "object"
    ? body.profile
    : undefined;
  let assembled: AssembledPipelinePayload | null = null;

  if (!suppliedProfile) {
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

    if (!assembled) {
      return jsonError("no_profile_data", 409, {
        hint: "complete at least one intake source before launching the pipeline",
      });
    }
  }

  try {
    const started = (await client.mutation(startOnboardingPipeline, {
      demoUserId: `auth:${userId}`,
      profile: suppliedProfile ?? assembled?.profile,
      limitSources: limitSources.value ?? 3,
      tailorLimit: tailorLimit.value ?? 3,
    })) as { demoUserId: string; runId: string; status: "started"; message: string };

    return Response.json({
      ok: true,
      demoUserId: started.demoUserId,
      runId: started.runId,
      status: started.status,
      message: started.message,
      used: assembled
        ? {
            userProfile: assembled.sources.userProfile,
            github: assembled.sources.github,
            linkedin: assembled.sources.linkedin,
            resume: assembled.sources.resume,
            repoSummaryCount: assembled.sources.repoSummaryCount,
            experienceSummaryCount: assembled.sources.experienceSummaryCount,
          }
        : {
            suppliedProfile: true,
            userProfile: false,
            github: false,
            linkedin: false,
            resume: false,
            repoSummaryCount: 0,
            experienceSummaryCount: 0,
          },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : String(err),
      500,
    );
  }
}

function parseOptionalPositiveInteger(
  value: unknown,
  min: number,
  max: number,
): { ok: true; value?: number } | { ok: false } {
  if (value === undefined) return { ok: true };
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
}
