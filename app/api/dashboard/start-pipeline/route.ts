import { makeFunctionReference } from "convex/server";

import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type StartPipelineClient = {
  mutation: (ref: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  // Test-only injection point so contract tests do not make real Convex calls.
  var __RECRUIT_START_PIPELINE_CLIENT_FOR_TEST__: StartPipelineClient | undefined;
}

const startOnboardingPipeline = makeFunctionReference<"mutation">(
  "ashby:startOnboardingPipeline"
);

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) {
    return jsonError("bad_request", 400);
  }

  const profile = body.value.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return jsonError("missing_profile", 400);
  }

  const client = globalThis.__RECRUIT_START_PIPELINE_CLIENT_FOR_TEST__ ?? await getConvexClient();
  if (!client) {
    return jsonError("missing_convex_url", 503);
  }

  try {
    const started = await client.mutation(startOnboardingPipeline, {
      profile,
      mode: "mixed",
      targetJobs: 150,
      maxJobs: 175,
      tailorLimit: 3,
    }) as { runId?: string; status?: "started" };

    return Response.json({
      ok: true,
      runId: started.runId,
      status: "started",
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500);
  }
}

async function readBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return { ok: true as const, value: {} };
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false as const };
    }
    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { ok: false as const };
  }
}

function jsonError(reason: string, status: number) {
  return Response.json({ ok: false, reason }, { status });
}
