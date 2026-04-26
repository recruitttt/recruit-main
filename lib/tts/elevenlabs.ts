// ElevenLabs text-to-speech — minimal server-side fetch wrapper.
//
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
//
// Server-only: reads `ELEVENLABS_API_KEY` at call time so the key never ships
// to the client. The TTS route is the only consumer.

const TTS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

/** Default voice — ElevenLabs "Sarah" stock voice. Friendly female narrator. */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMAC";

/** Default model — `turbo_v2_5` keeps time-to-first-byte under ~400ms. */
export const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

export interface SynthesizeOptions {
  voiceId?: string;
  modelId?: string;
  /** ISO 639-1, used only by the multilingual models. */
  languageCode?: string;
}

export type SynthesizeResult =
  | { ok: true; body: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; reason: string; status?: number };

export async function synthesizeSpeech(
  text: string,
  options: SynthesizeOptions = {},
  signal?: AbortSignal,
): Promise<SynthesizeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return { ok: false, reason: "empty_text" };

  const voiceId = options.voiceId ?? DEFAULT_VOICE_ID;
  const url = `${TTS_BASE}/${encodeURIComponent(voiceId)}`;

  const body: Record<string, unknown> = {
    text: trimmed,
    model_id: options.modelId ?? DEFAULT_MODEL_ID,
  };
  if (options.languageCode) body.language_code = options.languageCode;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network_error";
    return { ok: false, reason };
  }

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    return {
      ok: false,
      reason: errBody ? `http_${res.status}: ${errBody.slice(0, 240)}` : `http_${res.status}`,
      status: res.status,
    };
  }

  return {
    ok: true,
    body: res.body,
    contentType: res.headers.get("content-type") ?? "audio/mpeg",
  };
}
