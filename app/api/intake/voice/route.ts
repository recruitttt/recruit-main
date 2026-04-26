// Voice intake — Next.js route handler.
//
// Why this lives here (and not in `convex/intakeActions.ts`): we accept a raw
// audio Blob via `multipart/form-data` and forward it to ElevenLabs Scribe as
// a file upload. Convex actions can't ingest multipart bodies cleanly, and we
// don't want the ElevenLabs API key in the Convex deployment env.
//
// Pipeline:
//   1. Resolve better-auth session → userId.   (401 on miss)
//   2. Parse multipart body — `audio` file, optional `targets` (CSV).
//   3. Build a `ConvexHttpClient` so the adapter can write `intakeRuns`.
//   4. Stream SSE events via the same `runIntake` driver every other adapter
//      uses; the voice adapter handles transcription + extraction internally.

import { ConvexHttpClient } from "convex/browser";

import { getSessionUserId, getToken } from "@/lib/auth-server";
import { detectCredentials } from "@/lib/intake/github/models";
import { voiceAdapter } from "@/lib/intake/voice/adapter";
import { runIntake } from "@/lib/intake/shared/runIntake";
import { convexHttpClientToCtx } from "@/lib/intake/shared/runIntakeNode";
import { createSseWriter } from "@/lib/intake/shared/sse";
import type {
  AICredentials,
  IntakeAdapter,
  IntakeContext,
} from "@/lib/intake/shared/types";
import type { VoiceIntakeInput } from "@/lib/intake/voice/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 25 MB ceiling. Scribe accepts much larger but a recruiting-intake monologue
// has no business being that long, and the cap keeps the route from holding
// huge buffers in memory while we forward them to ElevenLabs.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const DEFAULT_TARGETS = [
  "name",
  "headline",
  "summary",
  "location",
  "experience",
  "education",
  "skills",
  "prefs",
];

function buildConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for the voice intake route.");
  }
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
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

function parseTargets(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return DEFAULT_TARGETS;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_TARGETS;
  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : DEFAULT_TARGETS;
}

export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid form data";
    return jsonError(msg, 400);
  }

  const audioField = form.get("audio");
  if (!(audioField instanceof Blob) || audioField.size === 0) {
    return jsonError("audio file required", 400);
  }
  if (audioField.size > MAX_AUDIO_BYTES) {
    return jsonError(`audio exceeds ${MAX_AUDIO_BYTES} bytes`, 413);
  }

  const targets = parseTargets(form.get("targets"));
  const languageCodeRaw = form.get("languageCode");
  const languageCode =
    typeof languageCodeRaw === "string" ? languageCodeRaw : undefined;

  let client: ConvexHttpClient;
  try {
    client = buildConvexClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "configuration error";
    return jsonError(msg, 503);
  }

  try {
    const token = await getToken();
    if (token) client.setAuth(token);
  } catch {
    // Mutations targeted by this route accept `userId` as an arg, so the call
    // still works without a forwarded session token.
  }

  // The voice adapter doesn't use `credentials` directly (it reads OPENAI_API_KEY
  // for extraction and ELEVENLABS_API_KEY for STT), but `IntakeContext` requires
  // a value. Use the same detector other intakes use; fall back to a stub if no
  // AI provider is configured locally.
  const credentials: AICredentials =
    detectCredentials(process.env) ?? { source: "anthropic", apiKey: "" };

  const stream = streamVoiceIntake({
    audio: audioField,
    targets,
    languageCode,
    userId,
    client,
    credentials,
    signal: req.signal,
  });

  return new Response(stream, { headers: sseHeaders() });
}

interface StreamInput {
  audio: Blob;
  targets: string[];
  languageCode: string | undefined;
  userId: string;
  client: ConvexHttpClient;
  credentials: AICredentials;
  signal?: AbortSignal;
}

function streamVoiceIntake({
  audio,
  targets,
  languageCode,
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

      const tappedAdapter: IntakeAdapter<VoiceIntakeInput> = {
        name: voiceAdapter.name,
        async *run(input, ctx) {
          for await (const event of voiceAdapter.run(input, ctx)) {
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
        await runIntake(
          tappedAdapter,
          { audio, extractTargets: targets, languageCode },
          intakeCtx,
        );
        streamWriter.send({ stage: "complete", message: "Voice intake complete" });
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
