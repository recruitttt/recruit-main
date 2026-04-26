// TTS — Next.js route handler.
//
// POST { text: string, voiceId?: string } → audio/mpeg streamed body.
//
// Auth-gated so the ElevenLabs quota can't be drained by anonymous callers.
// Streams the upstream body straight through to the client so the browser
// can start playing before generation completes.

import { z } from "zod";

import { getSessionUserId } from "@/lib/auth-server";
import { synthesizeSpeech, DEFAULT_VOICE_ID } from "@/lib/tts/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cap input length so a runaway prompt can't burn the quota in one call.
// Roughly 30s of speech at typical narration cadence.
const MAX_TEXT_CHARS = 1_200;

const RequestSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_CHARS),
  voiceId: z.string().min(1).max(64).optional(),
});

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  let body: z.infer<typeof RequestSchema>;
  try {
    const json: unknown = await req.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid request";
    return jsonError(msg, 400);
  }

  const result = await synthesizeSpeech(
    body.text,
    { voiceId: body.voiceId ?? DEFAULT_VOICE_ID },
    req.signal,
  );

  if (!result.ok) {
    if (result.reason === "missing_api_key") return jsonError("tts_unavailable", 503);
    const status = result.status && result.status >= 400 ? result.status : 502;
    return jsonError(result.reason, status);
  }

  return new Response(result.body, {
    headers: {
      "content-type": result.contentType,
      "cache-control": "no-store",
    },
  });
}
