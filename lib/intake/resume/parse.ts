// Resume parsing helpers — pure server-side, no Next.js Request handling.
//
// Factored out of `app/api/parse/resume/route.ts` so the resume IntakeAdapter
// (which receives a Convex `_storage` Blob, not a multipart Request) can share
// the exact same PDF + LLM extraction logic.
//
// Stages:
//   1. `extractPdfText` — pdfjs-dist via unpdf, returns the joined plain text.
//   2. `extractStructuredProfile` — GPT-5.4 Mini structures the text into a
//      `Partial<UserProfile>` that the intake driver can merge.
//
// Both functions return discriminated `{ ok: true, ... } | { ok: false, reason }`
// results so the caller can branch on failure without throwing.

// Polyfill Promise.try — pdfjs needs it on Node 22.x
// (V8 12.4 / Node 23+ ship it natively). pdfjs calls Promise.try with
// additional arguments, so the polyfill must forward them.
if (typeof (Promise as unknown as { try?: unknown }).try !== "function") {
  (
    Promise as unknown as {
      try: (
        fn: (...args: unknown[]) => unknown,
        ...args: unknown[]
      ) => Promise<unknown>;
    }
  ).try = (fn, ...args) =>
    new Promise((resolve) => resolve(fn(...args)));
}

import { extractText, getDocumentProxy } from "unpdf";

import { chatJSON } from "../../openai";
import type { UserProfile } from "../../profile";

// Let unpdf resolve its serverless pdfjs bundle. That bundle is self-contained
// and does not dynamically import pdf.worker.mjs, which Convex/Vercel-style
// server bundles cannot reliably ship next to the generated action chunk.

const RESUME_SYSTEM_PROMPT = `You are extracting a structured profile from a resume's plain text.
Return a JSON object with this exact shape (omit fields you cannot determine):
{
  "name": string,
  "email": string,
  "headline": string,           // a one-line professional summary (e.g. "Full-stack engineer focused on AI tooling")
  "summary": string,            // 2-3 sentence professional summary if visible
  "location": string,
  "skills": string[],           // technical skills - languages, frameworks, tools
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "description": string, "location": string }],
  "education": [{ "school": string, "degree": string, "field": string, "startDate": string, "endDate": string }]
}
Use ISO-like dates (YYYY-MM) when possible. For current roles, use endDate "Present".
Skip fields you cannot find rather than guessing.`;

const MAX_LLM_INPUT_CHARS = 16000;
const DEFAULT_RESUME_REVIEW_MODEL = "gpt-5.4-mini";

export type PdfTextResult =
  | { ok: true; rawText: string }
  | { ok: false; reason: string };

/** Decode a PDF Blob/ArrayBuffer/Uint8Array into plain text via pdfjs. */
export async function extractPdfText(
  source: Blob | ArrayBuffer | Uint8Array
): Promise<PdfTextResult> {
  try {
    const buf = await toUint8Array(source);
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const rawText = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (!rawText) return { ok: false, reason: "empty_pdf" };
    return { ok: true, rawText };
  } catch (err) {
    return {
      ok: false,
      reason: `pdf_parse_failed: ${(err as Error).message ?? "unknown"}`,
    };
  }
}

export type StructuredProfileResult =
  | { ok: true; structured: Partial<UserProfile> }
  | { ok: false; reason: string };

/**
 * Ask GPT-5.4 Mini to map plain resume text into a `Partial<UserProfile>`.
 * Returns `{ ok: false, reason: "no_api_key" }` when `OPENAI_API_KEY` is
 * absent so callers can degrade gracefully and still surface the raw text.
 */
export async function extractStructuredProfile(
  rawText: string,
  opts?: { apiKey?: string; model?: string; signal?: AbortSignal }
): Promise<StructuredProfileResult> {
  const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  const trimmed =
    rawText.length > MAX_LLM_INPUT_CHARS
      ? rawText.slice(0, MAX_LLM_INPUT_CHARS)
      : rawText;

  const llm = await chatJSON(
    apiKey,
    [
      { role: "system", content: RESUME_SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
    {
      model:
        opts?.model ??
        process.env.RESUME_REVIEW_MODEL ??
        DEFAULT_RESUME_REVIEW_MODEL,
      signal: opts?.signal,
    }
  );
  if (!llm.ok) return { ok: false, reason: llm.reason };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(llm.raw);
  } catch {
    parsed = {};
  }
  return { ok: true, structured: parsed as Partial<UserProfile> };
}

async function toUint8Array(
  source: Blob | ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  // Blob
  return new Uint8Array(await source.arrayBuffer());
}
