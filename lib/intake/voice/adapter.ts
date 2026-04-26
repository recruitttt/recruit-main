// Voice IntakeAdapter — the user records themselves describing their
// background; ElevenLabs Scribe transcribes the audio; the same field
// extraction LLM the chat adapter uses pulls structured profile fields out.
//
// Spec: see chat adapter (`lib/intake/chat/adapter.ts`) — voice mirrors its
// extraction step, with audio in front and `voice` provenance instead of
// `chat`.
//
// Stages: `starting` → `transcribe` → `extract-fields` → `complete`.
//
// Why a separate adapter (not "chat with audio in front"): adapter `name` is
// what `intakeRuns.kind` keys off, and provenance attribution must read
// "voice" so the UI can render audio-source affordances (waveform badge,
// playback) distinctly from typed chat. Sharing the LLM extraction call
// inline keeps the two paths from drifting on prompt details.

import { chatJSON, type ChatMessage } from "../../openai";
import type { UserProfile } from "../../profile";

import type {
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  ProvenanceSource,
} from "../shared/types";
import { transcribeWithScribe } from "./elevenlabs";

export interface VoiceIntakeInput {
  /** Recorded audio. Webm/Opus from MediaRecorder works. */
  audio: Blob;
  /** Top-level profile keys to extract (same contract as chat adapter). */
  extractTargets: string[];
  /** ISO 639-3. Defaults to `eng`. Pass empty string to let Scribe auto-detect. */
  languageCode?: string;
}

export const voiceAdapter: IntakeAdapter<VoiceIntakeInput> = {
  name: "voice",
  run: runVoiceAdapter,
};

const VOICE_PROVENANCE: ProvenanceSource = "voice";

const SUPPORTED_TARGETS = [
  "name",
  "email",
  "location",
  "headline",
  "summary",
  "links",
  "experience",
  "education",
  "skills",
  "prefs",
] as const;

type SupportedTarget = (typeof SUPPORTED_TARGETS)[number];
const SUPPORTED_TARGET_SET: ReadonlySet<string> = new Set(SUPPORTED_TARGETS);

const TARGET_SCHEMA_HINTS: Record<SupportedTarget, string> = {
  name: `"name": string  // user's full name`,
  email: `"email": string`,
  location: `"location": string  // "City, State" or "City, Country"`,
  headline: `"headline": string  // one-line professional summary`,
  summary: `"summary": string  // 2-3 sentence professional summary`,
  links: `"links": { "github"?: string, "linkedin"?: string, "twitter"?: string, "devpost"?: string, "website"?: string }`,
  experience: `"experience": [{ "company": string, "title": string, "startDate"?: string, "endDate"?: string, "description"?: string, "location"?: string }]`,
  education: `"education": [{ "school": string, "degree"?: string, "field"?: string, "startDate"?: string, "endDate"?: string }]`,
  skills: `"skills": string[]  // technical skills - languages, frameworks, tools`,
  prefs: `"prefs": { "roles"?: string[], "locations"?: string[], "workAuth"?: string, "minSalary"?: string, "companySizes"?: string[] }`,
};

async function* runVoiceAdapter(
  input: VoiceIntakeInput,
  _ctx: IntakeContext,
): AsyncGenerator<IntakeProgressEvent> {
  if (!input.audio || input.audio.size === 0) {
    yield { stage: "starting", level: "error", message: "No audio provided" };
    throw new Error("voice_empty_audio");
  }

  const targets = filterSupportedTargets(input.extractTargets);
  if (targets.length === 0) {
    yield {
      stage: "starting",
      level: "warn",
      message: "No supported extractTargets — voice intake skipped",
    };
    yield { stage: "complete", message: "Voice intake complete (noop)", level: "info" };
    return;
  }

  yield {
    stage: "starting",
    message: `Voice intake — ${formatBytes(input.audio.size)} of audio`,
    level: "info",
    data: { targets, audioBytes: input.audio.size },
  };

  // ---------------------------------------------------------------------------
  // 1. Transcribe with ElevenLabs Scribe.
  // ---------------------------------------------------------------------------
  yield { stage: "transcribe", message: "Transcribing with ElevenLabs Scribe", level: "info" };

  const stt = await transcribeWithScribe(input.audio, {
    languageCode: input.languageCode === undefined ? "eng" : input.languageCode || undefined,
  });

  if (!stt.ok) {
    if (stt.reason === "missing_api_key") {
      yield {
        stage: "transcribe",
        level: "warn",
        message: "ELEVENLABS_API_KEY missing — voice intake skipped",
      };
      yield { stage: "complete", message: "Voice intake complete (no api key)", level: "info" };
      return;
    }
    yield {
      stage: "transcribe",
      level: "error",
      message: `Transcription failed: ${stt.reason}`,
    };
    throw new Error(`voice_transcribe_failed: ${stt.reason}`);
  }

  yield {
    stage: "transcribe",
    message: `Transcribed ${stt.text.length} chars`,
    level: "info",
    data: {
      transcriptChars: stt.text.length,
      languageCode: stt.languageCode,
    },
  };

  // ---------------------------------------------------------------------------
  // 2. Extract structured fields from the transcript.
  // ---------------------------------------------------------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield {
      stage: "extract-fields",
      level: "warn",
      message: "OPENAI_API_KEY missing — voice intake skipped after transcribe",
    };
    yield { stage: "complete", message: "Voice intake complete (no api key)", level: "info" };
    return;
  }

  yield { stage: "extract-fields", message: "Extracting fields from transcript", level: "info" };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(targets) },
    { role: "user", content: stt.text },
  ];

  const llm = await chatJSON(apiKey, messages);
  if (!llm.ok) {
    yield {
      stage: "extract-fields",
      level: "error",
      message: `LLM extract failed: ${llm.reason}`,
    };
    throw new Error(`voice_extract_failed: ${llm.reason}`);
  }

  let parsed: Partial<UserProfile>;
  try {
    parsed = JSON.parse(llm.raw) as Partial<UserProfile>;
  } catch {
    parsed = {};
  }

  const sanitized = sanitizeForTargets(parsed, targets);
  if (Object.keys(sanitized).length === 0) {
    yield {
      stage: "extract-fields",
      level: "warn",
      message: "LLM returned no usable fields",
    };
    yield { stage: "complete", message: "Voice intake complete (no fields)", level: "info" };
    return;
  }

  yield {
    stage: "extract-fields",
    message: `Extracted ${Object.keys(sanitized).length} field${
      Object.keys(sanitized).length === 1 ? "" : "s"
    } from voice`,
    level: "info",
    patch: sanitized,
    provenance: provenanceFor(sanitized),
    data: { fields: Object.keys(sanitized) },
  };

  yield { stage: "complete", message: "Voice intake complete", level: "info" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterSupportedTargets(targets: string[]): SupportedTarget[] {
  if (!Array.isArray(targets)) return [];
  const seen = new Set<SupportedTarget>();
  const out: SupportedTarget[] = [];
  for (const raw of targets) {
    if (typeof raw !== "string") continue;
    const head = raw.split(".")[0];
    if (!SUPPORTED_TARGET_SET.has(head)) continue;
    const target = head as SupportedTarget;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}

function buildSystemPrompt(targets: SupportedTarget[]): string {
  const lines = targets.map((t) => `  ${TARGET_SCHEMA_HINTS[t]},`);
  return `You extract structured profile fields from a spoken-word transcript. The user recorded themselves describing their background; minor speech artifacts (filler words, restarts, "um"s) are normal — interpret intent, not literal phrasing.
Return a JSON object with ONLY the fields explicitly listed below. Omit any field you cannot determine from the transcript.
Use exactly this shape (omit unmentioned fields):
{
${lines.join("\n")}
}
Rules:
- Only include data the user clearly stated. Do not infer or guess.
- Use ISO-like dates (YYYY-MM) when possible. For current roles, use endDate "Present".
- Omit empty strings, empty arrays, and unknown fields entirely.`;
}

function sanitizeForTargets(
  raw: Partial<UserProfile>,
  targets: SupportedTarget[],
): Partial<UserProfile> {
  const allowed = new Set<SupportedTarget>(targets);
  const result: Partial<UserProfile> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key as SupportedTarget)) continue;
    if (!isMeaningful(value)) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

function isMeaningful(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function provenanceFor(patch: Partial<UserProfile>): Record<string, ProvenanceSource> {
  const out: Record<string, ProvenanceSource> = {};
  for (const key of Object.keys(patch)) {
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
    out[key] = VOICE_PROVENANCE;
  }
  return out;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
