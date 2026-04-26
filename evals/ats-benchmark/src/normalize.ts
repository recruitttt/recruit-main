import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkMetadata, BenchmarkSample } from "./types";
import { redactText } from "./redact";

type NormalizeOptions = {
  inputDir: string;
  outputPath: string;
  source?: string;
};

export async function normalizeDataset(options: NormalizeOptions): Promise<{
  samples: BenchmarkSample[];
  outputPath: string;
}> {
  const files = await listDataFiles(options.inputDir);
  const samples: BenchmarkSample[] = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    for (const record of parseRecords(raw)) {
      const sample = normalizeRecord(record, {
        source: options.source ?? "resume-score-details",
        fallbackId: path.basename(file),
      });
      if (sample) samples.push(sample);
    }
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    samples.map((sample) => JSON.stringify(sample)).join("\n") + (samples.length ? "\n" : ""),
    "utf8"
  );
  return { samples, outputPath: options.outputPath };
}

export async function loadNormalizedSamples(inputPath: string): Promise<BenchmarkSample[]> {
  const raw = await readFile(inputPath, "utf8");
  return parseRecords(raw)
    .map((record, index) =>
      normalizeBenchmarkSample(record, `sample_${String(index + 1).padStart(4, "0")}`)
    )
    .filter((sample): sample is BenchmarkSample => sample !== null);
}

export function normalizeRecord(
  record: unknown,
  opts: { source: string; fallbackId: string }
): BenchmarkSample | null {
  if (!record || typeof record !== "object") return null;
  const root = record as Record<string, unknown>;
  const input = objectAt(root.input) ?? root;
  const resumeText = firstString(
    input.resume,
    input.resume_text,
    input.resumeText,
    input.cv,
    root.resume,
    root.resume_text
  );
  const jobDescription = firstString(
    input.job_description,
    input.jobDescription,
    input.jd,
    root.job_description,
    root.jobDescription
  );
  if (!resumeText || !jobDescription) return null;

  const score = firstNumber(
    root.score,
    root.total_score,
    root.final_score,
    objectAt(root.output)?.score,
    objectAt(root.output)?.total_score
  );
  const rawRequirements =
    arrayOfStrings(root.minimum_requirements) ??
    arrayOfStrings(input.minimum_requirements) ??
    arrayOfStrings(objectAt(root.output)?.minimum_requirements) ??
    [];
  const id = firstString(root.id, root.sample_id, root.uuid) ?? stableId(opts.fallbackId, resumeText, jobDescription);
  const valid = inferValidity(root, resumeText, jobDescription);
  const details = objectAt(root.details);
  const output = objectAt(root.output);
  const personalInfo = objectAt(output?.personal_info);
  const sanitizedDetails = sanitizeRecord(details);
  const sanitizedPersonalInfo = sanitizeRecord(personalInfo);
  const metadata = buildMetadata({
    sourceFile: opts.fallbackId,
    details: sanitizedDetails,
    personalInfo: sanitizedPersonalInfo,
    resumeText,
  });
  return {
    sampleId: id,
    source: opts.source,
    resumeText: redactText(resumeText),
    jobDescription: redactText(jobDescription),
    minimumRequirements: rawRequirements.map(redactText),
    referenceScore: score === undefined ? undefined : normalizeScore(score),
    referenceLabel: inferLabel(root, score),
    valid: valid && !metadata.dataQuality?.resumeLooksLikeJobDescription,
    roleFamily: inferRoleFamily(jobDescription),
    metadata,
  };
}

export function normalizeBenchmarkSample(record: unknown, fallbackId: string): BenchmarkSample | null {
  if (!record || typeof record !== "object") return null;
  const root = record as Partial<BenchmarkSample>;
  if (typeof root.resumeText !== "string" || typeof root.jobDescription !== "string") return null;
  return {
    sampleId: typeof root.sampleId === "string" ? root.sampleId : fallbackId,
    source: typeof root.source === "string" ? root.source : "normalized",
    resumeText: redactText(root.resumeText),
    jobDescription: redactText(root.jobDescription),
    minimumRequirements: Array.isArray(root.minimumRequirements)
      ? root.minimumRequirements.filter((item): item is string => typeof item === "string").map(redactText)
      : [],
    referenceScore: typeof root.referenceScore === "number" ? normalizeScore(root.referenceScore) : undefined,
    referenceLabel: root.referenceLabel,
    valid:
      root.valid !== false &&
      root.resumeText.trim().length > 30 &&
      root.jobDescription.trim().length > 30 &&
      root.metadata?.dataQuality?.resumeLooksLikeJobDescription !== true,
    roleFamily: typeof root.roleFamily === "string" ? root.roleFamily : inferRoleFamily(root.jobDescription),
    metadata: root.metadata,
  };
}

async function listDataFiles(inputDir: string): Promise<string[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(inputDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listDataFiles(fullPath));
    } else if (/\.(json|jsonl)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function parseRecords(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split(/\n+/).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function objectAt(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length > 0 ? strings : undefined;
}

function normalizeScore(score: number): number {
  if (score <= 1) return Math.round(score * 100);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferValidity(root: Record<string, unknown>, resumeText: string, jobDescription: string): boolean {
  if (root.valid === false || root.is_valid === false) return false;
  if (typeof root.status === "string" && /invalid|error|failed/i.test(root.status)) return false;
  return resumeText.trim().length > 30 && jobDescription.trim().length > 30;
}

function buildMetadata(input: {
  sourceFile: string;
  details?: Record<string, unknown>;
  personalInfo?: Record<string, unknown>;
  resumeText: string;
}): BenchmarkMetadata {
  const details = input.details;
  const personalInfo = input.personalInfo;
  const skills = arrayOfStrings(details?.skills) ?? [];
  const employmentHistory = Array.isArray(details?.employment_history)
    ? details.employment_history.filter((item): item is Record<string, unknown> => Boolean(objectAt(item)))
    : [];
  const projects = Array.isArray(details?.projects)
    ? details.projects.filter((item): item is Record<string, unknown> => Boolean(objectAt(item)))
    : [];
  const employers = uniqueStrings([
    ...employmentHistory.flatMap((item) => [
      firstString(item.company_name),
      companyFromDetails(firstString(item.details)),
    ]),
    firstString(personalInfo?.current_company),
  ]);
  const projectNames = uniqueStrings(projects.map((item) => firstString(item.title, item.name)));
  const hasStructuredProfile =
    Boolean(firstString(details?.name, personalInfo?.name)) ||
    skills.length > 0 ||
    employmentHistory.length > 0 ||
    projects.length > 0 ||
    employers.length > 0;
  const resumeLooksLikeJobDescription = looksLikeJobDescription(input.resumeText);
  const reasons = [
    resumeLooksLikeJobDescription ? "resume_looks_like_job_description" : "",
    !hasStructuredProfile ? "missing_structured_profile" : "",
  ].filter(Boolean);
  return {
    sourceFile: input.sourceFile,
    ...(details ? { details } : {}),
    ...(personalInfo ? { personalInfo } : {}),
    structuredProfile: {
      hasStructuredProfile,
      name: firstString(details?.name, personalInfo?.name),
      email: firstString(details?.email_id, personalInfo?.email),
      phone: firstString(details?.number, personalInfo?.phone),
      location: firstString(details?.location),
      currentCompany: firstString(personalInfo?.current_company),
      currentPosition: firstString(personalInfo?.current_position),
      skills,
      employers,
      projects: projectNames,
    },
    dataQuality: {
      resumeLooksLikeJobDescription,
      missingStructuredProfile: !hasStructuredProfile,
      reasons,
    },
  };
}

function sanitizeRecord(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return sanitizeValue(value) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeValue(item)])
    );
  }
  return value;
}

function looksLikeJobDescription(text: string): boolean {
  const head = text.slice(0, 1200).toLowerCase();
  const signals = [
    /\bexperience required\b/,
    /\bbasic salary range\b/,
    /\bkey responsibilities\b/,
    /\beligibility:\b/,
    /\bjob title:\b/,
    /\bjob summary\b/,
    /\babout us:\b/,
    /\bqualifications:\b/,
    /\bto apply:\b/,
  ];
  const score = signals.filter((signal) => signal.test(head)).length;
  const resumeSignals = /\b(work experience|employment history|education|projects|certifications)\b/.test(head);
  return score >= 2 || (score >= 1 && !resumeSignals && /\b(company|location|responsibilities)\b/.test(head));
}

function inferLabel(root: Record<string, unknown>, score?: number): BenchmarkSample["referenceLabel"] {
  const label = firstString(root.label, root.match_label, root.referenceLabel);
  if (label) {
    if (/mismatch|no/i.test(label)) return "mismatch";
    if (/partial|medium/i.test(label)) return "partial";
    if (/match|fit|yes/i.test(label)) return "match";
  }
  if (score === undefined) return undefined;
  const normalized = normalizeScore(score);
  if (normalized >= 75) return "match";
  if (normalized >= 45) return "partial";
  return "mismatch";
}

function companyFromDetails(details?: string): string | undefined {
  if (!details) return undefined;
  const match = details.match(/\bat\s+([^,\n]+)/i);
  return match?.[1]?.trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function inferRoleFamily(jobDescription: string): string {
  const text = jobDescription.toLowerCase();
  if (/\b(data scientist|machine learning|ml engineer|ai engineer|analytics)\b/.test(text)) return "data-ai";
  if (/\b(frontend|front-end|react|ui engineer|web developer)\b/.test(text)) return "frontend";
  if (/\b(backend|back-end|platform|infrastructure|api|distributed)\b/.test(text)) return "backend";
  if (/\b(product manager|product owner|technical pm)\b/.test(text)) return "product";
  if (/\b(designer|ux|ui\/ux)\b/.test(text)) return "design";
  return "general";
}

function stableId(seed: string, resumeText: string, jobDescription: string): string {
  let hash = 0;
  const value = `${seed}:${resumeText.slice(0, 100)}:${jobDescription.slice(0, 100)}`;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `sample_${hash.toString(16)}`;
}
