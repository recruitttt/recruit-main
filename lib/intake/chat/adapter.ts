// Chat IntakeAdapter — given a chat history and a list of profile field paths
// the caller wants populated, ask GPT-4o-mini to extract those fields and
// emit them as a `Partial<UserProfile>` patch with `chat` provenance.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.5.
//
// Stages emitted: `starting` → `extract-fields` → `complete`.

import { chatJSON, type ChatMessage } from "../../openai";
import type { UserProfile } from "../../profile";

import type {
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  ProvenanceSource,
} from "../shared/types";

export type ChatRole = "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

/**
 * Top-level field paths the caller wants extracted. Any unknown / unsupported
 * targets are silently dropped — the LLM is only prompted for the supported
 * intersection so it does not hallucinate fields the schema cannot store.
 */
export type ChatExtractTarget = keyof UserProfile | string;

export interface ChatIntakeInput {
  messages: ChatHistoryMessage[];
  extractTargets: ChatExtractTarget[];
}

export const chatAdapter: IntakeAdapter<ChatIntakeInput> = {
  name: "chat",
  run: runChatAdapter,
};

const MAX_HISTORY_CHARS = 16000;
const CHAT_PROVENANCE: ProvenanceSource = "chat";

/**
 * Subset of `UserProfile` keys we actually let the chat adapter populate. The
 * other keys are derived (`provenance`, `log`, `updatedAt`, `suggestions`) or
 * owned by other adapters (`github`, `resume`).
 */
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

async function* runChatAdapter(
  input: ChatIntakeInput,
  _ctx: IntakeContext
): AsyncGenerator<IntakeProgressEvent> {
  // Validate inputs early so the run row records a clear failure.
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    yield { stage: "starting", level: "error", message: "Empty chat history" };
    throw new Error("empty_chat_history");
  }

  const targets = filterSupportedTargets(input.extractTargets);
  if (targets.length === 0) {
    yield {
      stage: "starting",
      level: "warn",
      message: "No supported extractTargets — chat intake skipped",
    };
    yield { stage: "complete", message: "Chat intake complete (noop)", level: "info" };
    return;
  }

  yield {
    stage: "starting",
    message: `Extracting ${targets.length} field${targets.length === 1 ? "" : "s"} from chat`,
    level: "info",
    data: { targets, messages: input.messages.length },
  };

  // ---------------------------------------------------------------------------
  // 1. LLM extraction.
  // ---------------------------------------------------------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield {
      stage: "extract-fields",
      level: "warn",
      message: "OPENAI_API_KEY missing — chat intake skipped",
    };
    yield { stage: "complete", message: "Chat intake complete (no api key)", level: "info" };
    return;
  }

  yield { stage: "extract-fields", message: "Asking GPT-4o-mini", level: "info" };

  const transcript = formatTranscript(input.messages);
  const systemPrompt = buildSystemPrompt(targets);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: transcript },
  ];

  const llm = await chatJSON(apiKey, messages);
  if (!llm.ok) {
    yield {
      stage: "extract-fields",
      level: "error",
      message: `LLM extract failed: ${llm.reason}`,
    };
    throw new Error(`chat_extract_failed: ${llm.reason}`);
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
    yield { stage: "complete", message: "Chat intake complete (no fields)", level: "info" };
    return;
  }

  yield {
    stage: "extract-fields",
    message: `Extracted ${Object.keys(sanitized).length} field${
      Object.keys(sanitized).length === 1 ? "" : "s"
    } from chat`,
    level: "info",
    patch: sanitized,
    provenance: provenanceFor(sanitized),
    data: { fields: Object.keys(sanitized) },
  };

  yield { stage: "complete", message: "Chat intake complete", level: "info" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterSupportedTargets(targets: ChatExtractTarget[]): SupportedTarget[] {
  if (!Array.isArray(targets)) return [];
  const seen = new Set<SupportedTarget>();
  const out: SupportedTarget[] = [];
  for (const raw of targets) {
    if (typeof raw !== "string") continue;
    // Accept either the bare key or a dotted path — we only extract at the
    // top level for now, so trim to the segment before the first dot.
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
  return `You extract structured profile fields from a chat transcript between a user and a recruiting assistant.
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

function formatTranscript(messages: ChatHistoryMessage[]): string {
  const lines: string[] = [];
  let totalChars = 0;
  // Walk newest-last so when we trim we keep the earliest context.
  for (const m of messages) {
    if (typeof m?.content !== "string") continue;
    if (m.role !== "user" && m.role !== "assistant") continue;
    const tag = m.role === "user" ? "USER" : "ASSISTANT";
    const line = `${tag}: ${m.content}`;
    lines.push(line);
    totalChars += line.length + 1;
  }
  let joined = lines.join("\n");
  if (joined.length > MAX_HISTORY_CHARS) {
    joined = joined.slice(joined.length - MAX_HISTORY_CHARS);
  }
  return joined;
}

function sanitizeForTargets(
  raw: Partial<UserProfile>,
  targets: SupportedTarget[]
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
    out[key] = CHAT_PROVENANCE;
  }
  return out;
}
