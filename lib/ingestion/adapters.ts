import type {
  IngestionFetch,
  IngestionProvider,
  IngestionSource,
  NormalizedIngestionJob,
  SourceFetchResult,
} from "./types";
import {
  IngestionHttpError,
  arrayValue,
  canonicalUrl,
  compensationFields,
  fetchJson,
  inferRemote,
  numberValue,
  objectValue,
  stringValue,
  stripHtml,
  withQuery,
} from "./utils";

const ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards";
const LEVER_API_BASES = {
  global: "https://api.lever.co/v0/postings",
  eu: "https://api.eu.lever.co/v0/postings",
};
const LEVER_PAGE_SIZE = 100;

export async function fetchJobsForSource(
  source: IngestionSource,
  fetchFn: IngestionFetch = fetch
): Promise<SourceFetchResult> {
  const started = Date.now();
  try {
    const jobs = await fetchProviderJobs(source, fetchFn);
    return {
      source,
      jobs,
      errors: [],
      sourceStatus: {
        provider: source.provider,
        company: source.company,
        slug: source.slug,
        ok: true,
        jobCount: jobs.length,
        durationMs: Date.now() - started,
      },
    };
  } catch (err) {
    const statusCode = err instanceof IngestionHttpError ? err.statusCode : undefined;
    const message = err instanceof Error && err.message ? err.message : String(err);
    return {
      source,
      jobs: [],
      errors: [message],
      sourceStatus: {
        provider: source.provider,
        company: source.company,
        slug: source.slug,
        ok: false,
        jobCount: 0,
        statusCode,
        error: message,
        durationMs: Date.now() - started,
      },
    };
  }
}

export function normalizeSource(input: unknown): IngestionSource | null {
  const record = objectValue(input);
  const provider = stringValue(record.provider);
  if (!isProvider(provider)) return null;
  const company = stringValue(record.company);
  const slug = stringValue(record.slug);
  if (!company || !slug) return null;
  return {
    provider,
    company,
    slug,
    careersUrl: stringValue(record.careersUrl),
    enabled: record.enabled !== false,
    config: objectValue(record.config),
  };
}

export function normalizeAshbyJob(
  source: IngestionSource,
  job: unknown
): NormalizedIngestionJob | null {
  const record = objectValue(job);
  const title = stringValue(record.title);
  const jobUrl = stringValue(record.jobUrl);
  if (!title || !jobUrl) return null;
  const compensation = objectValue(record.compensation);
  const compensationSummary =
    stringValue(compensation.compensationTierSummary) ??
    stringValue(compensation.scrapeableCompensationSalarySummary);
  const location = [
    stringValue(record.location),
    ...arrayValue(record.secondaryLocations)
      .map((item) => stringValue(objectValue(item).location))
      .filter((item): item is string => Boolean(item)),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    provider: "ashby",
    company: source.company,
    sourceSlug: `ashby:${source.slug}`,
    title,
    normalizedTitle: title.toLowerCase(),
    location: location || undefined,
    isRemote: record.isRemote === true || inferRemote([location]),
    workplaceType: stringValue(record.workplaceType),
    employmentType: stringValue(record.employmentType),
    department: stringValue(record.department),
    team: stringValue(record.team),
    descriptionPlain:
      stringValue(record.descriptionPlain) ?? stripHtml(stringValue(record.descriptionHtml)),
    ...compensationFields(compensationSummary),
    jobUrl,
    applyUrl: stringValue(record.applyUrl) ?? jobUrl,
    publishedAt: stringValue(record.publishedAt),
    dedupeKey: `ashby:${source.slug}:${canonicalUrl(jobUrl)}`,
    raw: job,
  };
}

export function normalizeGreenhouseJob(
  source: IngestionSource,
  job: unknown
): NormalizedIngestionJob | null {
  const record = objectValue(job);
  const title = stringValue(record.name ?? record.title);
  const jobUrl = stringValue(record.absolute_url ?? record.url);
  const stableId = stringValue(record.id) ?? jobUrl;
  if (!title || !jobUrl || !stableId) return null;
  const metadata = metadataMap(record.metadata);
  const location = [
    stringValue(objectValue(record.location).name),
    ...arrayValue(record.offices)
      .map((office) => stringValue(objectValue(office).name))
      .filter((item): item is string => Boolean(item)),
  ]
    .filter(Boolean)
    .join(" · ");
  const department = arrayValue(record.departments)
    .map((departmentItem) => stringValue(objectValue(departmentItem).name))
    .filter(Boolean)[0];
  const compensationSummary =
    metadata.compensation ?? metadata.salary ?? metadata.pay ?? metadata.payRange;
  const workplaceType = metadata.workplaceType ?? metadata.workplace;

  return {
    provider: "greenhouse",
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
    descriptionPlain: stripHtml(stringValue(record.content)),
    ...compensationFields(compensationSummary),
    jobUrl,
    applyUrl: stringValue(record.apply_url) ?? jobUrl,
    publishedAt: stringValue(record.updated_at),
    dedupeKey: `greenhouse:${source.slug}:${stableId}`,
    raw: job,
  };
}

export function normalizeLeverJob(
  source: IngestionSource,
  job: unknown
): NormalizedIngestionJob | null {
  const record = objectValue(job);
  const title = stringValue(record.text);
  const jobUrl = stringValue(record.hostedUrl ?? record.hosted_url ?? record.url);
  const stableId = stringValue(record.id) ?? jobUrl;
  if (!title || !jobUrl || !stableId) return null;
  const categories = objectValue(record.categories);
  const salaryRange = objectValue(record.salaryRange);
  const compensationSummary =
    stringValue(record.salaryDescriptionPlain ?? record.salaryDescription) ??
    leverSalaryRangeSummary(salaryRange);
  const parsedCompensation = compensationFields(compensationSummary);
  const location = [
    stringValue(categories.location),
    ...arrayValue(record.locations)
      .map((item) => stringValue(typeof item === "object" ? objectValue(item).name : item))
      .filter((item): item is string => Boolean(item)),
  ]
    .filter(Boolean)
    .join(" · ");
  const workplaceType = stringValue(record.workplaceType ?? categories.workplaceType);

  return {
    provider: "lever",
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
      stringValue(record.descriptionPlain) ?? stripHtml(stringValue(record.description)),
    compensationSummary,
    salaryMin:
      numberValue(salaryRange.min) ??
      numberValue(salaryRange.minimum) ??
      parsedCompensation.salaryMin,
    salaryMax:
      numberValue(salaryRange.max) ??
      numberValue(salaryRange.maximum) ??
      parsedCompensation.salaryMax,
    currency: stringValue(salaryRange.currency) ?? parsedCompensation.currency,
    jobUrl,
    applyUrl: stringValue(record.applyUrl) ?? jobUrl,
    publishedAt: stringValue(record.createdAt),
    dedupeKey: `lever:${source.slug}:${stableId}`,
    raw: job,
  };
}

export function normalizeWorkableJob(
  source: IngestionSource,
  job: unknown
): NormalizedIngestionJob | null {
  const record = objectValue(job);
  const title = stringValue(record.title);
  const stableId =
    stringValue(record.shortcode) ??
    stringValue(record.id) ??
    stringValue(record.code) ??
    stringValue(record.url);
  const jobUrl =
    stringValue(record.url) ??
    stringValue(record.shortlink) ??
    stringValue(record.application_url) ??
    (stableId ? `https://apply.workable.com/${source.slug}/j/${stableId}/` : undefined);
  if (!title || !jobUrl || !stableId) return null;

  const location = workableLocation(record);
  const department = stringValue(record.department);
  const employmentType =
    stringValue(record.type) ??
    stringValue(record.employment_type) ??
    stringValue(record.employmentType);
  const descriptionPlain =
    stripHtml(stringValue(record.description)) ??
    stripHtml(stringValue(record.full_description)) ??
    stringValue(record.descriptionPlain);

  return {
    provider: "workable",
    company: source.company,
    sourceSlug: `workable:${source.slug}`,
    title,
    normalizedTitle: title.toLowerCase(),
    location,
    isRemote: record.telecommuting === true || inferRemote([location, stringValue(record.workplace)]),
    workplaceType: stringValue(record.workplace),
    employmentType,
    department,
    descriptionPlain,
    jobUrl,
    applyUrl: stringValue(record.application_url) ?? jobUrl,
    publishedAt: stringValue(record.published_on ?? record.created_at),
    dedupeKey: `workable:${source.slug}:${stableId}`,
    raw: job,
  };
}

async function fetchProviderJobs(source: IngestionSource, fetchFn: IngestionFetch) {
  if (source.provider === "ashby") {
    const url = `${ASHBY_API_BASE}/${encodeURIComponent(source.slug)}?includeCompensation=true`;
    const { json } = await fetchJson<{ jobs?: unknown[] }>(url, fetchFn);
    return arrayValue(json.jobs)
      .map((job) => normalizeAshbyJob(source, job))
      .filter((job): job is NormalizedIngestionJob => job !== null);
  }

  if (source.provider === "greenhouse") {
    const configuredUrl = stringValue(source.config?.apiUrl);
    const url = configuredUrl
      ? withQuery(configuredUrl, { content: "true" })
      : `${GREENHOUSE_API_BASE}/${encodeURIComponent(source.slug)}/jobs?content=true`;
    const { json } = await fetchJson<{ jobs?: unknown[] }>(url, fetchFn);
    return arrayValue(json.jobs)
      .map((job) => normalizeGreenhouseJob(source, job))
      .filter((job): job is NormalizedIngestionJob => job !== null);
  }

  if (source.provider === "lever") {
    const region = source.config?.region === "eu" ? "eu" : "global";
    const base = LEVER_API_BASES[region];
    const jobs: NormalizedIngestionJob[] = [];
    let skip = 0;
    while (true) {
      const url = `${base}/${encodeURIComponent(source.slug)}?mode=json&skip=${skip}&limit=${LEVER_PAGE_SIZE}`;
      const { json } = await fetchJson<unknown[]>(url, fetchFn);
      const postings = arrayValue(json);
      jobs.push(
        ...postings
          .map((job) => normalizeLeverJob(source, job))
          .filter((job): job is NormalizedIngestionJob => job !== null)
      );
      if (postings.length < LEVER_PAGE_SIZE) break;
      skip += LEVER_PAGE_SIZE;
    }
    return jobs;
  }

  const configuredUrl = stringValue(source.config?.apiUrl);
  const url =
    configuredUrl ??
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(source.slug)}`;
  const { json } = await fetchJson<unknown>(url, fetchFn);
  return extractWorkableJobs(json)
    .map((job) => normalizeWorkableJob(source, job))
    .filter((job): job is NormalizedIngestionJob => job !== null);
}

function isProvider(value: unknown): value is IngestionProvider {
  return typeof value === "string" && ["ashby", "greenhouse", "lever", "workable"].includes(value);
}

function metadataMap(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of arrayValue(value)) {
    const record = objectValue(item);
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

function leverSalaryRangeSummary(value: Record<string, unknown>) {
  const min = numberValue(value.min ?? value.minimum);
  const max = numberValue(value.max ?? value.maximum);
  const currency = stringValue(value.currency) ?? "USD";
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

function workableLocation(record: Record<string, unknown>) {
  if (typeof record.location === "string") return stringValue(record.location);
  const nestedLocation = objectValue(record.location);
  const parts = [
    stringValue(nestedLocation.city ?? record.city),
    stringValue(nestedLocation.region ?? nestedLocation.state ?? record.state),
    stringValue(nestedLocation.country ?? record.country),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function extractWorkableJobs(json: unknown) {
  if (Array.isArray(json)) return json;
  const record = objectValue(json);
  if (Array.isArray(record.jobs)) return record.jobs;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.positions)) return record.positions;
  return [];
}
