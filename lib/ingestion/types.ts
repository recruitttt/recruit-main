export const INGESTION_PROVIDERS = ["ashby", "greenhouse", "lever", "workable"] as const;

export type IngestionProvider = typeof INGESTION_PROVIDERS[number];

export type IngestionSource = {
  provider: IngestionProvider;
  company: string;
  slug: string;
  careersUrl?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type NormalizedIngestionJob = {
  provider: IngestionProvider;
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
  raw: unknown;
};

export type SourceStatus = {
  provider: IngestionProvider;
  company: string;
  slug: string;
  ok: boolean;
  jobCount: number;
  statusCode?: number;
  error?: string;
  durationMs: number;
};

export type SourceFetchResult = {
  source: IngestionSource;
  jobs: NormalizedIngestionJob[];
  errors: string[];
  sourceStatus: SourceStatus;
};

export type IngestionFetch = typeof fetch;

export type ProviderTotals = {
  provider: IngestionProvider;
  sourceCount: number;
  okSourceCount: number;
  failedSourceCount: number;
  rawJobCount: number;
  dedupedJobCount: number;
};

export type IngestionSmokeSummary = {
  ok: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providers: IngestionProvider[];
  sourceCount: number;
  rawJobCount: number;
  dedupedJobCount: number;
  duplicateCount: number;
  providerTotals: ProviderTotals[];
  sourceStatuses: SourceStatus[];
  errors: Array<{
    provider: IngestionProvider;
    company: string;
    slug: string;
    message: string;
  }>;
  sampleJobs: NormalizedIngestionJob[];
};
