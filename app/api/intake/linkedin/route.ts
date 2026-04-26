// LinkedIn intake — Next.js route handler.
//
// Why this lives here (and not in `convex/intakeActions.ts`): the LinkedIn
// adapter pulls `playwright-core` (via `@browserbasehq/sdk`). The Convex
// Node bundler crashes when analyzing playwright at deploy time — the action
// typechecks but won't deploy. Per spec §11.2 / §13 + subagent D's notes,
// the LinkedIn intake runs as a Next API route on Vercel where playwright
// is a normal native dep.
//
// The other adapters (github, resume, web, chat) STAY as Convex actions —
// they have no native deps and benefit from the action runtime's scheduler.
//
// Pipeline (mirrors the previous `runLinkedinIntake` Convex action):
//   1. Resolve the better-auth session → userId.       (401 on miss)
//   2. Validate `{ profileUrl }` body.                  (400 on miss/invalid)
//   3. Build a `ConvexHttpClient` so the adapter can read/write Convex.
//   4. Stream SSE events back to the browser as the adapter progresses.
//      Every event is also persisted into `intakeRuns` by `runIntake`, so
//      the existing `useQuery(api.intakeRuns.byUserKind, ...)` badges in
//      the onboarding page keep updating live.

import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { getSessionUserId, getToken } from "@/lib/auth-server";
import { linkedinAdapter } from "@/lib/intake/linkedin";
import {
  resolveLinkedInAiCredentials,
  type LinkedInSharedRuntimeConfig,
} from "@/lib/intake/linkedin/runtime-config";
import {
  isLinkedinProfileUrl,
  normalizeLinkedinProfileUrl,
} from "@/lib/intake/shared/source-state";
import { runIntake } from "@/lib/intake/shared/runIntake";
import { convexHttpClientToCtx } from "@/lib/intake/shared/runIntakeNode";
import { createSseWriter } from "@/lib/intake/shared/sse";
import type {
  AICredentials,
  IntakeAdapter,
  IntakeContext,
} from "@/lib/intake/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps Serverless Functions at 300 seconds.
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  profileUrl: z.preprocess(
    (value) =>
      typeof value === "string" ? normalizeLinkedinProfileUrl(value) : value,
    z.string().url().refine(isLinkedinProfileUrl, {
      message: "URL must look like https://www.linkedin.com/in/<handle>",
    })
  ),
});

type RequestBody = z.infer<typeof RequestSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is required for the LinkedIn intake route."
    );
  }
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

async function readSharedRuntimeConfig(
  client: ConvexHttpClient,
): Promise<LinkedInSharedRuntimeConfig | null> {
  try {
    return (await client.query(
      api.linkedinCookies.getSharedRuntimeConfig,
      {},
    )) as LinkedInSharedRuntimeConfig | null;
  } catch {
    return null;
  }
}

function sseHeaders(): HeadersInit {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  };
}

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // ---- Auth -------------------------------------------------------------
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  // ---- Body validation --------------------------------------------------
  let body: RequestBody;
  try {
    const json: unknown = await req.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid request";
    return jsonError(msg, 400);
  }

  // ---- Convex client + AI credentials ----------------------------------
  let client: ConvexHttpClient;
  let credentials: AICredentials;
  let sharedRuntimeConfig: LinkedInSharedRuntimeConfig | null = null;
  try {
    client = buildConvexClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "configuration error";
    return jsonError(msg, 503);
  }

  // Forward the better-auth token before reading shared runtime config or
  // mutating profile state. Localhost machines intentionally rely on Convex
  // deployment env for LinkedIn/Browserbase/AI config, not per-developer env.
  try {
    const token = await getToken();
    if (token) client.setAuth(token);
  } catch {
    // Mutations targeted by this route accept `userId` arg, so unauthenticated
    // calls still work. We only attach the token when available.
  }

  try {
    sharedRuntimeConfig = await readSharedRuntimeConfig(client);
    credentials = resolveLinkedInAiCredentials(process.env, sharedRuntimeConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "configuration error";
    return jsonError(msg, 503);
  }

  // Persist the submitted URL before the long-running scrape begins. That lets
  // /profile show LinkedIn as saved/processing immediately instead of waiting
  // for Browserbase + LinkedIn auth + scraping to finish.
  try {
    await client.mutation(api.userProfiles.merge, {
      userId,
      patch: { links: { linkedin: body.profileUrl } },
      provenance: { "links.linkedin": "linkedin" },
      label: "linkedin:saved",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed to save LinkedIn URL";
    return jsonError(msg, 503);
  }

  // ---- Stream SSE -------------------------------------------------------
  const stream = streamLinkedinIntake({
    profileUrl: body.profileUrl,
    runtimeConfig: sharedRuntimeConfig,
    userId,
    client,
    credentials,
    signal: req.signal,
  });

  return new Response(stream, { headers: sseHeaders() });
}

// ---------------------------------------------------------------------------
// SSE stream construction
//
// Each adapter event is forwarded to the SSE client and persisted into
// `intakeRuns` by the `runIntake` driver. We wrap the adapter in a tiny
// proxy that taps each yielded event before re-yielding it to the driver,
// so live progress reaches both the streaming consumer (this request) and
// the `useQuery(api.intakeRuns.byUserKind, ...)` subscribers (everywhere
// else in the app).
// ---------------------------------------------------------------------------

interface StreamInput {
  profileUrl: string;
  runtimeConfig: LinkedInSharedRuntimeConfig | null;
  userId: string;
  client: ConvexHttpClient;
  credentials: AICredentials;
  signal?: AbortSignal;
}

function streamLinkedinIntake({
  profileUrl,
  runtimeConfig,
  userId,
  client,
  credentials,
  signal,
}: StreamInput): ReadableStream<Uint8Array> {
  let writer: ReturnType<typeof createSseWriter> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const streamWriter = createSseWriter(controller);
      writer = streamWriter;
      const onAbort = () => streamWriter.cancel();
      signal?.addEventListener("abort", onAbort, { once: true });

      const tappedAdapter: IntakeAdapter<{
        profileUrl: string;
        runtimeConfig?: LinkedInSharedRuntimeConfig | null;
      }> = {
        name: linkedinAdapter.name,
        async *run(input, ctx) {
          for await (const event of linkedinAdapter.run(input, ctx)) {
            streamWriter.send(event);
            yield event;
          }
        },
      };

      const intakeCtx: IntakeContext = {
        userId,
        ctx: convexHttpClientToCtx(client),
        credentials,
        now: () => new Date().toISOString(),
      };

      try {
        await runIntake(tappedAdapter, { profileUrl, runtimeConfig }, intakeCtx);
        streamWriter.send({ stage: "complete", message: "LinkedIn intake complete" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        streamWriter.send({ stage: "error", level: "error", error: message });
      } finally {
        signal?.removeEventListener("abort", onAbort);
        streamWriter.close();
      }
    },
    cancel() {
      writer?.cancel();
    },
  });
}
