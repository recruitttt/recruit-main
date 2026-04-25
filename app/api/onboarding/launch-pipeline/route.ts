import { makeFunctionReference } from "convex/server";

import { getConvexClient } from "@/lib/convex-http";
import type { UserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  profile?: UserProfile;
};

const startOnboardingPipeline = makeFunctionReference<"mutation">("ashby:startOnboardingPipeline");

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

  if (!body.profile) {
    return Response.json({ ok: false, reason: "missing_profile" }, { status: 400 });
  }

  try {
    const started = await client.mutation(startOnboardingPipeline, {
      profile: body.profile,
      limitSources: 3,
      tailorLimit: 3,
    }) as { runId: string; status: "started"; message: string };

    return Response.json({
      ok: true,
      runId: started.runId,
      status: started.status,
      message: started.message,
    });
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
