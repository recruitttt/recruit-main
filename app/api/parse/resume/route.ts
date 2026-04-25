// POST multipart form-data with a "file" field (PDF) ->
// { ok: true, rawText, structured: Partial<UserProfile> }
// 1. unpdf extracts plain text from the PDF buffer
// 2. GPT-4o-mini structures it into name/headline/summary/skills/experience/education

// Polyfill Promise.try - the bundled pdfjs in unpdf relies on it,
// but Node 22.x doesn't ship it (added in V8 12.4 / Node 23+).
// Must run before unpdf is imported.
if (typeof (Promise as unknown as { try?: unknown }).try !== "function") {
  (Promise as unknown as { try: (fn: () => unknown) => Promise<unknown> }).try =
    (fn) => new Promise((resolve) => resolve(fn()));
}

import { definePDFJSModule, extractText, getDocumentProxy } from "unpdf";
import { chatJSON } from "@/lib/openai";

// Use the official pdfjs-dist v4 build instead of unpdf's serverless bundle.
// The serverless bundle hits "Cannot destructure property 'docId'" on Node 22.
let pdfjsReady: Promise<void> | null = null;
function ensurePDFJS(): Promise<void> {
  if (!pdfjsReady) {
    pdfjsReady = definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  }
  return pdfjsReady;
}

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are extracting a structured profile from a resume's plain text.
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

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, reason: "missing_file" }, { status: 400 });
  }

  let rawText = "";
  try {
    await ensurePDFJS();
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    rawText = (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch (err) {
    return Response.json(
      { ok: false, reason: `pdf_parse_failed: ${(err as Error).message}` },
      { status: 422 }
    );
  }

  if (!rawText) {
    return Response.json(
      { ok: false, reason: "empty_pdf" },
      { status: 422 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // We have rawText but no key - return it so the user's resume isn't lost.
    return Response.json({
      ok: true,
      rawText,
      structured: null,
      reason: "no_api_key",
    });
  }

  const trimmed = rawText.length > 16000 ? rawText.slice(0, 16000) : rawText;

  const llm = await chatJSON(apiKey, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: trimmed },
  ]);

  if (!llm.ok) {
    return Response.json({
      ok: true,
      rawText,
      structured: null,
      reason: llm.reason,
      filename: file.name,
    });
  }

  let structured: Record<string, unknown>;
  try {
    structured = JSON.parse(llm.raw);
  } catch {
    structured = {};
  }

  return Response.json({
    ok: true,
    rawText,
    structured,
    filename: file.name,
  });
}
