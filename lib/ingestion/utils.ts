import { parseCompensation } from "@/lib/job-ranking";
import type { IngestionFetch } from "./types";

export class IngestionHttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "IngestionHttpError";
    this.statusCode = statusCode;
  }
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferRemote(values: Array<string | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (!text) return undefined;
  return /\b(remote|distributed|work from home|wfh|anywhere)\b/.test(text);
}

export function compensationFields(summary?: string) {
  const parsed = parseCompensation(summary);
  return {
    compensationSummary: summary,
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    currency: parsed.currency,
  };
}

export function canonicalUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|gh_src|source|ref)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

export function withQuery(url: string, params: Record<string, string>) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

export async function fetchJson<T>(
  url: string,
  fetchFn: IngestionFetch = fetch,
  init: RequestInit = {}
): Promise<{ json: T; statusCode: number }> {
  const res = await fetchFn(url, init);
  if (!res.ok) {
    throw new IngestionHttpError(`HTTP ${res.status}`, res.status);
  }
  return { json: await res.json() as T, statusCode: res.status };
}

export async function parallelMap<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
