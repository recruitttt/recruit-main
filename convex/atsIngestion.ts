/* eslint-disable @typescript-eslint/no-explicit-any */

import { parseCompensation } from "../lib/job-ranking";

export type AtsProvider = "greenhouse" | "lever" | "workday";

export type AtsSource = {
  _id?: string;
  provider: AtsProvider;
  company: string;
  slug: string;
  careersUrl?: string;
  enabled?: boolean;
  config?: Record<string, any>;
  seededFrom?: string;
  updatedAt?: string;
};

export type NormalizedAtsJob = {
  sourceId?: string;
  company: string;
  sourceSlug: string;
  title: string;
  normalizedTitle: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  department?: string;
  team?: string;
  descriptionPlain?: string;
  compensationSummary?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  jobUrl: string;
  applyUrl?: string;
  publishedAt?: string;
  dedupeKey: string;
  raw: any;
};

export type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: HeadersInit;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        { headers: options.headers },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await sleep(250 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const vendorStatus = vendorStatusFromUrl(url, res.status);
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === retries) {
      throw new Error(vendorStatus);
    }
    await sleep(retryDelayMs(res, attempt));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function parallelMap<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export function normalizeGreenhouseJob(
  source: AtsSource,
  job: any,
  runId: string
): NormalizedAtsJob | null {
  const title = stringValue(job.name ?? job.title);
  const jobUrl = stringValue(job.absolute_url ?? job.url);
  const stableId = stringValue(job.id) ?? jobUrl;
  if (!title || !jobUrl || !stableId) return null;

  const location = [
    stringValue(job.location?.name),
    ...arrayValue(job.offices)
      .map((office) => stringValue(office?.name))
      .filter(Boolean),
  ]
    .filter(Boolean)
    .join(" · ");
  const department = arrayValue(job.departments)
    .map((departmentItem) => stringValue(departmentItem?.name))
    .filter(Boolean)[0];
  const metadata = metadataMap(job.metadata);
  const compensationSummary =
    metadata.compensation ?? metadata.salary ?? metadata.pay ?? metadata.payRange;
  const parsedCompensation = parseCompensation(compensationSummary);
  const descriptionPlain = stripHtml(stringValue(job.content));
  const workplaceType = metadata.workplaceType ?? metadata.workplace;

  return {
    company: source.company,
    sourceSlug: `greenhouse:${source.slug}`,
    title,
    normalizedTitle: title.toLowerCase(),
    location: location || undefined,
    isRemote: inferRemote([location, workplaceType, metadata.remote]),
    workplaceType,
    employmentType: metadata.employmentType ?? metadata.commitment,
    department,
    team: metadata.team,
    descriptionPlain,
    compensationSummary,
    salaryMin: parsedCompensation.min ?? undefined,
    salaryMax: parsedCompensation.max ?? undefined,
    currency: parsedCompensation.currency,
    jobUrl,
    applyUrl: stringValue(job.apply_url) ?? jobUrl,
    publishedAt: stringValue(job.updated_at),
    dedupeKey: `greenhouse:${source.slug}:${stableId}`,
    raw: { ...job, provider: "greenhouse", runId },
  };
}

export function normalizeLeverJob(
  source: AtsSource,
  job: any,
  runId: string
): NormalizedAtsJob | null {
  const title = stringValue(job.text);
  const jobUrl = stringValue(job.hostedUrl ?? job.hosted_url ?? job.url);
  const stableId = stringValue(job.id) ?? jobUrl;
  if (!title || !jobUrl || !stableId) return null;

  const categories = job.categories ?? {};
  const workplaceType = stringValue(job.workplaceType ?? categories.workplaceType);
  const compensationSummary =
    stringValue(job.salaryDescriptionPlain ?? job.salaryDescription) ??
    leverSalaryRangeSummary(job.salaryRange);
  const salaryRange = job.salaryRange ?? {};
  const parsedCompensation = parseCompensation(compensationSummary);
  const currency = stringValue(salaryRange.currency) ?? parsedCompensation.currency;
  const salaryMin =
    numberValue(salaryRange.min) ?? numberValue(salaryRange.minimum) ?? parsedCompensation.min;
  const salaryMax =
    numberValue(salaryRange.max) ?? numberValue(salaryRange.maximum) ?? parsedCompensation.max;
  const location = [stringValue(categories.location), ...stringArray(job.locations)]
    .filter(Boolean)
    .join(" · ");

  return {
    company: source.company,
    sourceSlug: `lever:${source.slug}`,
    title,
    normalizedTitle: title.toLowerCase(),
    location: location || undefined,
    isRemote: inferRemote([location, workplaceType]),
    workplaceType,
    employmentType: stringValue(categories.commitment),
    department: stringValue(categories.department),
    team: stringValue(categories.team),
    descriptionPlain:
      stringValue(job.descriptionPlain) ?? stripHtml(stringValue(job.description)),
    compensationSummary,
    salaryMin: salaryMin ?? undefined,
    salaryMax: salaryMax ?? undefined,
    currency,
    jobUrl,
    applyUrl: stringValue(job.applyUrl) ?? jobUrl,
    publishedAt: stringValue(job.createdAt),
    dedupeKey: `lever:${source.slug}:${stableId}`,
    raw: { ...job, provider: "lever", runId },
  };
}

export function normalizeWorkdayJob(
  source: AtsSource,
  row: any,
  runId: string
): NormalizedAtsJob | null {
  const aliases = (source.config?.columns ?? {}) as Record<string, string>;
  const get = (name: string) => stringValue(row[aliases[name] ?? name]);
  const title = get("title");
  const jobUrl = get("jobUrl");
  const stableId = get("jobId") ?? jobUrl;
  if (!title || !jobUrl || !stableId) return null;

  const compensationSummary = get("compensationSummary");
  const parsedCompensation = parseCompensation(compensationSummary);
  const location = get("location");
  const workplaceType = get("workplaceType");

  return {
    company: get("company") ?? source.company,
    sourceSlug: `workday:${source.slug}`,
    title,
    normalizedTitle: title.toLowerCase(),
    location,
    isRemote: inferRemote([location, workplaceType]),
    workplaceType,
    employmentType: get("employmentType"),
    department: get("department"),
    team: get("team"),
    descriptionPlain: get("descriptionPlain") ?? stripHtml(get("descriptionHtml")),
    compensationSummary,
    salaryMin: parsedCompensation.min ?? numberValue(row[aliases.salaryMin ?? "salaryMin"]),
    salaryMax: parsedCompensation.max ?? numberValue(row[aliases.salaryMax ?? "salaryMax"]),
    currency: get("currency") ?? parsedCompensation.currency,
    jobUrl,
    applyUrl: get("applyUrl") ?? jobUrl,
    publishedAt: get("publishedAt"),
    dedupeKey: `workday:${source.slug}:${stableId}`,
    raw: { ...row, provider: "workday", runId },
  };
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
    .replace(/\s+/g, " ")
    .trim();
}

function retryDelayMs(res: Response, attempt: number) {
  const retryAfter = res.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  return 250 * 2 ** attempt;
}

function vendorStatusFromUrl(url: string, status: number) {
  if (url.includes("greenhouse.io")) return `greenhouse_${status}`;
  if (url.includes("lever.co")) return `lever_${status}`;
  if (url.includes("/ccx/service/customreport")) return `workday_${status}`;
  return `vendor_${status}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function metadataMap(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(value)) return map;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawName = stringValue(record.name ?? record.label);
    const rawValue = stringValue(record.value);
    if (!rawName || !rawValue) continue;
    const key = rawName
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, letter: string) => letter.toUpperCase())
      .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
    map[key] = rawValue;
  }
  return map;
}

function leverSalaryRangeSummary(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const range = value as Record<string, unknown>;
  const min = numberValue(range.min ?? range.minimum);
  const max = numberValue(range.max ?? range.maximum);
  const currency = stringValue(range.currency) ?? "USD";
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

function inferRemote(values: Array<string | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (!text) return undefined;
  return /\b(remote|distributed|work from home|wfh)\b/.test(text);
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stringValue(typeof item === "object" && item ? (item as any).name : item))
    .filter((item): item is string => Boolean(item));
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
