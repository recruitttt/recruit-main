// ElevenLabs Scribe (speech-to-text) — minimal server-side fetch wrapper.
//
// Docs: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
//
// Server-only: reads `ELEVENLABS_API_KEY` at call time so the key never ships
// to the client. The voice intake route is the only consumer.

const SCRIBE_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

export interface ScribeOptions {
  /** ElevenLabs STT model id. Default `scribe_v1`. */
  modelId?: string;
  /** ISO 639-3 language code (e.g. `eng`). Omit to let Scribe auto-detect. */
  languageCode?: string;
}

export type ScribeResult =
  | { ok: true; text: string; languageCode?: string; languageProbability?: number }
  | { ok: false; reason: string; status?: number };

interface ScribeResponseBody {
  text?: unknown;
  language_code?: unknown;
  language_probability?: unknown;
}

export async function transcribeWithScribe(
  audio: Blob,
  options: ScribeOptions = {},
  signal?: AbortSignal,
): Promise<ScribeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  if (!audio || audio.size === 0) {
    return { ok: false, reason: "empty_audio" };
  }

  const form = new FormData();
  form.append("model_id", options.modelId ?? "scribe_v1");
  if (options.languageCode) form.append("language_code", options.languageCode);
  // ElevenLabs accepts the audio as `file`. Filename is informational; pick
  // an extension that hints at the recorder's container so Scribe's mime
  // sniffer has a fallback if the Blob arrives without a type.
  const filename = audio.type.includes("webm") ? "audio.webm" : "audio.bin";
  form.append("file", audio, filename);

  let res: Response;
  try {
    res = await fetch(SCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network_error";
    return { ok: false, reason };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      reason: body ? `http_${res.status}: ${body.slice(0, 240)}` : `http_${res.status}`,
      status: res.status,
    };
  }

  let parsed: ScribeResponseBody;
  try {
    parsed = (await res.json()) as ScribeResponseBody;
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
  if (!text) return { ok: false, reason: "empty_transcript" };

  return {
    ok: true,
    text,
    languageCode: typeof parsed.language_code === "string" ? parsed.language_code : undefined,
    languageProbability:
      typeof parsed.language_probability === "number" ? parsed.language_probability : undefined,
  };
}
