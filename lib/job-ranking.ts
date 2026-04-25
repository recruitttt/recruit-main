export type RankingProfile = {
  headline?: string;
  summary?: string;
  location?: string;
  skills?: string[];
  experience?: Array<{
    title?: string;
    company?: string;
    description?: string;
  }>;
  prefs?: {
    roles?: string[];
    locations?: string[];
    workAuth?: string;
    minSalary?: string;
    companySizes?: string[];
  };
};

export type RankingJob = {
  id: string;
  title: string;
  company: string;
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
};

export type FilterDecision = {
  status: "kept" | "rejected";
  reasons: string[];
  ruleScore: number;
};

const JUNIOR_RE = /\b(junior|intern|internship|new grad|new-grad|graduate|entry[-\s]?level|apprentice)\b/i;
const SENIOR_RE = /\b(senior|staff|principal|lead|head|director|manager)\b/i;
const FULLSTACK_RE = /\b(full[-\s]?stack|founding engineer|software engineer)\b/i;
const FRONTEND_RE = /\b(front[-\s]?end|frontend|ui engineer|web engineer|web developer|design engineer|react)\b/i;
const BACKEND_RE = /\b(back[-\s]?end|backend|platform|infrastructure|devops|site reliability|sre|distributed systems|database|api engineer)\b/i;
const PRODUCT_RE = /\b(product manager|technical pm|product lead|product)\b/i;
const DATA_RE = /\b(data|machine learning|ml|ai|llm|applied ai|nlp|analytics)\b/i;
const SOLUTIONS_RE = /\b(solutions|forward deployed|deployed engineer|customer engineer|sales engineer|developer advocate|devrel)\b/i;
const BUSINESS_ROLE_RE = /\b(account executive|sales|business development|marketing|recruiter|talent|people|hr|legal|finance|customer success|customer support|support engineer|support specialist|operations)\b/i;

export function evaluateHardFilters(
  job: RankingJob,
  profile: RankingProfile
): FilterDecision {
  const reasons: string[] = [];
  const targetText = profileText(profile);
  const title = job.title.trim();
  const titleText = `${title} ${job.department ?? ""} ${job.team ?? ""}`;

  if (SENIOR_RE.test(targetText) && JUNIOR_RE.test(titleText)) {
    reasons.push("seniority_mismatch");
  }

  const targetFamilies = inferFamilies(targetText);
  const jobFamilies = inferFamilies(titleText);
  const isFullStack = FULLSTACK_RE.test(titleText);

  if (
    targetFamilies.has("backend") &&
    !targetFamilies.has("frontend") &&
    jobFamilies.has("frontend") &&
    !isFullStack
  ) {
    reasons.push("role_family_frontend_mismatch");
  }

  if (
    targetFamilies.has("frontend") &&
    !targetFamilies.has("backend") &&
    jobFamilies.has("backend") &&
    !isFullStack
  ) {
    reasons.push("role_family_backend_mismatch");
  }

  if (
    targetFamilies.has("product") &&
    !targetFamilies.has("engineering") &&
    (jobFamilies.has("backend") || jobFamilies.has("frontend")) &&
    !jobFamilies.has("product")
  ) {
    reasons.push("role_family_engineering_mismatch");
  }

  if (
    (targetFamilies.has("engineering") ||
      targetFamilies.has("backend") ||
      targetFamilies.has("frontend") ||
      targetFamilies.has("data")) &&
    BUSINESS_ROLE_RE.test(titleText) &&
    !jobFamilies.has("solutions")
  ) {
    reasons.push("role_family_business_mismatch");
  }

  if (isLocationMismatch(job, profile)) {
    reasons.push("location_mismatch");
  }

  const minSalary = parseMoney(profile.prefs?.minSalary ?? "");
  const salaryMax = job.salaryMax ?? parseCompensation(job.compensationSummary).max;
  if (minSalary !== null && salaryMax !== null && salaryMax < minSalary) {
    reasons.push("salary_below_minimum");
  }

  return {
    status: reasons.length > 0 ? "rejected" : "kept",
    reasons,
    ruleScore: scoreRules(job, profile, reasons),
  };
}

export function buildProfileSearchQuery(profile: RankingProfile): string {
  const roles = profile.prefs?.roles ?? [];
  const skills = profile.skills ?? [];
  const experience = profile.experience ?? [];
  const chunks = [
    roles.join(" "),
    roles.join(" "),
    profile.headline ?? "",
    profile.summary ?? "",
    skills.slice(0, 18).join(" "),
    experience
      .slice(0, 4)
      .map((item) =>
        [item.title, item.company, item.description].filter(Boolean).join(" ")
      )
      .join(" "),
  ];
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function parseCompensation(summary?: string): {
  min: number | null;
  max: number | null;
  currency?: string;
} {
  if (!summary) return { min: null, max: null };
  const values: number[] = [];
  let currency: string | undefined;
  const re = /([$€£])?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m)?/gi;
  for (const match of summary.matchAll(re)) {
    const symbol = match[1];
    const raw = Number(match[2].replace(/,/g, ""));
    const suffix = match[3]?.toLowerCase();
    if (!Number.isFinite(raw)) continue;
    if (symbol && !currency) currency = symbolToCurrency(symbol);
    if (raw < 1000 && !suffix) continue;
    const value =
      suffix === "m" ? raw * 1_000_000 : suffix === "k" ? raw * 1000 : raw;
    if (value >= 1000) values.push(value);
  }
  if (values.length === 0) return { min: null, max: null, currency };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    currency,
  };
}

export function parseMoney(value: string): number | null {
  const parsed = parseCompensation(value);
  return parsed.max;
}

export function normalizeScore(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.round(Math.min(100, (value / max) * 100));
}

function scoreRules(
  job: RankingJob,
  profile: RankingProfile,
  rejectionReasons: string[]
): number {
  if (rejectionReasons.length > 0) {
    return Math.max(0, 35 - rejectionReasons.length * 10);
  }

  let score = 62;
  const targetText = profileText(profile);
  const titleText = `${job.title} ${job.department ?? ""} ${job.team ?? ""}`;
  const targetFamilies = inferFamilies(targetText);
  const jobFamilies = inferFamilies(titleText);

  for (const family of targetFamilies) {
    if (jobFamilies.has(family)) score += 8;
  }
  if (job.isRemote || /remote|worldwide|anywhere/i.test(job.location ?? "")) {
    score += 5;
  }
  if (SENIOR_RE.test(targetText) && SENIOR_RE.test(titleText)) {
    score += 7;
  }
  if (job.compensationSummary || job.salaryMax) {
    score += 3;
  }
  return Math.max(0, Math.min(100, score));
}

function profileText(profile: RankingProfile): string {
  return [
    profile.headline,
    profile.summary,
    profile.prefs?.roles?.join(" "),
    profile.skills?.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function inferFamilies(text: string): Set<string> {
  const out = new Set<string>();
  if (FRONTEND_RE.test(text)) out.add("frontend");
  if (BACKEND_RE.test(text)) {
    out.add("backend");
    out.add("engineering");
  }
  if (FULLSTACK_RE.test(text)) {
    out.add("frontend");
    out.add("backend");
    out.add("engineering");
  }
  if (PRODUCT_RE.test(text)) out.add("product");
  if (DATA_RE.test(text)) out.add("data");
  if (SOLUTIONS_RE.test(text)) out.add("solutions");
  return out;
}

function isLocationMismatch(job: RankingJob, profile: RankingProfile): boolean {
  const desired = (profile.prefs?.locations ?? [])
    .map((loc) => loc.toLowerCase().trim())
    .filter(Boolean);
  if (desired.length === 0) return false;
  if (desired.some((loc) => loc.includes("remote"))) return false;

  const jobLocation = (job.location ?? "").toLowerCase();
  const jobRemote =
    job.isRemote ||
    /remote|worldwide|anywhere/i.test(job.location ?? "") ||
    /remote/i.test(job.workplaceType ?? "");
  if (jobRemote) return false;

  return !desired.some((loc) => jobLocation.includes(loc));
}

function symbolToCurrency(symbol: string): string {
  if (symbol === "$") return "USD";
  if (symbol === "€") return "EUR";
  if (symbol === "£") return "GBP";
  return symbol;
}
