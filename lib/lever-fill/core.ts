import {
  buildAshbyQuestionNodes,
  hashAshbyPrompt,
  normalizeAshbyText,
} from "../ashby-fill/core";
import type { AshbyControlKind } from "../ashby-fill/types";
import type {
  LeverBaseTemplate,
  LeverBaseTemplateField,
  LeverFieldObservation,
  LeverQuestionNode,
} from "./types";

export function validateDirectLeverApplicationUrl(targetUrl: string): {
  normalizedUrl: string;
  companySlug: string;
  postingId: string;
} {
  const url = new URL(targetUrl);
  if (url.hostname.toLowerCase() !== "jobs.lever.co") {
    throw new Error("lever_url_host_not_supported");
  }
  url.hash = "";
  url.search = "";
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("lever_direct_application_url_required");
  const [companySlug, postingId] = parts;
  url.pathname = `/${companySlug}/${postingId}/apply`;
  return {
    normalizedUrl: url.toString(),
    companySlug,
    postingId,
  };
}

export function extractLeverJobId(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    if (url.hostname.toLowerCase() !== "jobs.lever.co") return null;
    return url.pathname.split("/").filter(Boolean)[1] ?? null;
  } catch {
    return null;
  }
}

export function extractLeverCompanySlug(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    if (url.hostname.toLowerCase() !== "jobs.lever.co") return null;
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export function parseLeverBaseTemplate(raw: string | null | undefined): LeverBaseTemplate | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    return {
      id: stringValue(parsed.id),
      text: stringValue(parsed.text) ?? "",
      fields: fields
        .map((field): LeverBaseTemplateField | null => {
          if (!field || typeof field !== "object" || Array.isArray(field)) return null;
          const record = field as Record<string, unknown>;
          const options = Array.isArray(record.options)
            ? record.options
                .map((option) => {
                  if (typeof option === "string") return option.trim();
                  if (!option || typeof option !== "object" || Array.isArray(option)) return "";
                  return stringValue((option as Record<string, unknown>).text) ?? "";
                })
                .filter(Boolean)
            : [];
          return {
            type: stringValue(record.type) ?? "text",
            text: stringValue(record.text) ?? "",
            description: stringValue(record.description) ?? "",
            required: record.required === true,
            id: stringValue(record.id),
            options,
          };
        })
        .filter((field): field is LeverBaseTemplateField => Boolean(field)),
    };
  } catch {
    return null;
  }
}

export function leverControlKindFromCardType(type: string | null | undefined): AshbyControlKind {
  const normalized = normalizeAshbyText(type);
  if (normalized === "textarea") return "textarea";
  if (normalized === "dropdown") return "select";
  if (normalized === "multiple-choice") return "radio";
  if (normalized === "multiple-select") return "checkbox";
  if (normalized === "file") return "file";
  if (normalized === "text") return "text";
  return "text";
}

export function buildLeverQuestionNodes(fields: LeverFieldObservation[]): LeverQuestionNode[] {
  return buildAshbyQuestionNodes(fields).map((question) => ({
    ...question,
    prompt_hash: question.prompt_hash || hashAshbyPrompt(question.question_text) || question.normalized_prompt,
  }));
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export { normalizeAshbyText as normalizeLeverText, hashAshbyPrompt as hashLeverPrompt };
