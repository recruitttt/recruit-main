// Resume IntakeAdapter — pulls a PDF from Convex `_storage`, extracts plain
// text via pdfjs, then asks GPT-5.4 Mini to structure the result into a
// `Partial<UserProfile>` patch.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.3.
//
// Stages emitted: `starting` → `parse-pdf` → `llm-extract` → `complete`.
// Provenance: every top-level key of the resulting patch → `"resume"`.

import type { Id } from "../../../convex/_generated/dataModel";

import {
  extractPdfText,
  extractStructuredProfile,
} from "./parse";
import type {
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  ProvenanceSource,
  UserProfile,
} from "../shared/types";

export interface ResumeIntakeInput {
  /** Convex `_storage` id for the uploaded PDF. */
  fileId: Id<"_storage">;
  /** Optional human-readable filename (preserved on `profile.resume`). */
  filename?: string;
}

export const resumeAdapter: IntakeAdapter<ResumeIntakeInput> = {
  name: "resume",
  run: runResumeAdapter,
};

async function* runResumeAdapter(
  input: ResumeIntakeInput,
  ctx: IntakeContext
): AsyncGenerator<IntakeProgressEvent> {
  yield {
    stage: "starting",
    message: "Loading resume from storage",
    level: "info",
  };

  // ---------------------------------------------------------------------------
  // 1. Pull the PDF blob from Convex `_storage`.
  // ---------------------------------------------------------------------------
  const blob = await ctx.ctx.storage.get(input.fileId);
  if (!blob) {
    yield {
      stage: "parse-pdf",
      level: "error",
      message: "Resume file not found in storage",
    };
    throw new Error("resume_file_missing");
  }

  // ---------------------------------------------------------------------------
  // 2. PDF -> plain text.
  // ---------------------------------------------------------------------------
  yield {
    stage: "parse-pdf",
    message: "Extracting text from PDF",
    level: "info",
  };

  const pdfResult = await extractPdfText(blob);
  if (!pdfResult.ok) {
    yield {
      stage: "parse-pdf",
      level: "error",
      message: pdfResult.reason,
    };
    throw new Error(pdfResult.reason);
  }

  const filename = input.filename ?? "resume.pdf";

  // Persist the raw text + filename immediately so the user sees their resume
  // surface even if the LLM extraction step fails or has no API key.
  const resumePatch: Partial<UserProfile> = {
    resume: {
      filename,
      rawText: pdfResult.rawText,
      uploadedAt: ctx.now(),
    },
  };
  yield {
    stage: "parse-pdf",
    message: `Extracted ${pdfResult.rawText.length} chars from PDF`,
    level: "info",
    patch: resumePatch,
    provenance: provenanceFor(resumePatch),
    data: { chars: pdfResult.rawText.length, filename },
  };

  // ---------------------------------------------------------------------------
  // 3. LLM-structured extraction.
  // ---------------------------------------------------------------------------
  yield {
    stage: "llm-extract",
    message: "Structuring resume with GPT-5.4 Mini",
    level: "info",
  };

  const structuredResult = await extractStructuredProfile(pdfResult.rawText);
  if (!structuredResult.ok) {
    // Non-fatal: keep the rawText that was already merged, surface the reason.
    const level: IntakeProgressEvent["level"] =
      structuredResult.reason === "no_api_key" ? "warn" : "error";
    yield {
      stage: "llm-extract",
      level,
      message: `Resume LLM extraction skipped: ${structuredResult.reason}`,
    };
    yield { stage: "complete", message: "Resume intake finished (raw text only)", level: "info" };
    return;
  }

  // Strip empty / non-Profile keys before merging.
  const sanitized = sanitizeProfilePatch(structuredResult.structured);
  if (Object.keys(sanitized).length === 0) {
    yield {
      stage: "llm-extract",
      level: "warn",
      message: "Resume LLM extraction returned no usable fields",
    };
    yield { stage: "complete", message: "Resume intake finished (raw text only)", level: "info" };
    return;
  }

  yield {
    stage: "llm-extract",
    message: `Resume parsed (${Object.keys(sanitized).length} field${
      Object.keys(sanitized).length === 1 ? "" : "s"
    })`,
    level: "info",
    patch: sanitized,
    provenance: provenanceFor(sanitized),
    data: { fields: Object.keys(sanitized) },
  };

  yield { stage: "complete", message: "Resume intake complete", level: "info" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PROFILE_KEYS: ReadonlySet<keyof UserProfile> = new Set<keyof UserProfile>([
  "name",
  "email",
  "location",
  "headline",
  "summary",
  "links",
  "resume",
  "experience",
  "education",
  "skills",
  "github",
  "prefs",
  "suggestions",
  "provenance",
  "log",
  "updatedAt",
]);

const RESUME_PROVENANCE: ProvenanceSource = "resume";

function provenanceFor(patch: Partial<UserProfile>): Record<string, ProvenanceSource> {
  const out: Record<string, ProvenanceSource> = {};
  for (const key of Object.keys(patch)) {
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
    out[key] = RESUME_PROVENANCE;
  }
  return out;
}

function sanitizeProfilePatch(raw: Partial<UserProfile>): Partial<UserProfile> {
  const result: Partial<UserProfile> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_PROFILE_KEYS.has(key as keyof UserProfile)) continue;
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
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
