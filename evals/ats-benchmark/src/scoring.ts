import type { AtsScoreBreakdown, JobKeywords } from "./types";

const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "with",
  "for",
  "from",
  "that",
  "this",
  "role",
  "team",
  "work",
  "experience",
  "years",
  "strong",
  "ability",
  "skills",
]);

export function extractFallbackKeywords(jobDescription: string): JobKeywords {
  const tokens = jobDescription
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([token]) => token);
  return { required_skills: [], preferred_skills: [], keywords };
}

export function normalizeKeywords(keywords: JobKeywords): {
  required: string[];
  preferred: string[];
  other: string[];
  all: string[];
} {
  const required = uniqueStrings(keywords.required_skills);
  const preferred = uniqueStrings(keywords.preferred_skills);
  const other = uniqueStrings([
    ...(Array.isArray(keywords.keywords) ? keywords.keywords : []),
    ...(Array.isArray(keywords.key_responsibilities) ? keywords.key_responsibilities : []),
  ]);
  return { required, preferred, other, all: uniqueStrings([...required, ...preferred, ...other]) };
}

export function scoreResumeTextWithKeywords(
  resumeText: string,
  keywords: JobKeywords
): AtsScoreBreakdown {
  const normalized = normalizeKeywords(keywords);
  const text = resumeText.toLowerCase();
  const matchedKeywords = normalized.all.filter((keyword) => keywordInText(keyword, text));
  const missingKeywords = normalized.all.filter((keyword) => !keywordInText(keyword, text));
  const requiredScore = percentMatched(normalized.required, text);
  const preferredScore = percentMatched(normalized.preferred, text);
  const keywordScore = percentMatched(normalized.other, text);

  const weightedNumerator =
    requiredScore * (normalized.required.length > 0 ? 0.5 : 0) +
    preferredScore * (normalized.preferred.length > 0 ? 0.25 : 0) +
    keywordScore * (normalized.other.length > 0 ? 0.25 : 0);
  const activeWeight =
    (normalized.required.length > 0 ? 0.5 : 0) +
    (normalized.preferred.length > 0 ? 0.25 : 0) +
    (normalized.other.length > 0 ? 0.25 : 0);
  const score = activeWeight > 0 ? Math.round(weightedNumerator / activeWeight) : 0;

  return {
    score: clamp(score),
    matchedKeywords,
    missingKeywords,
    requiredScore,
    preferredScore,
    keywordScore,
    totalKeywords: normalized.all.length,
    flags: normalized.all.length === 0 ? ["no_keywords"] : [],
  };
}

export function keywordInText(keyword: string, lowerText: string): boolean {
  const normalized = keyword.toLowerCase().trim();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaryStart = /^[a-z0-9]/.test(normalized) ? "\\b" : "";
  const boundaryEnd = /[a-z0-9]$/.test(normalized) ? "\\b" : "";
  return new RegExp(`${boundaryStart}${escaped}${boundaryEnd}`, "i").test(lowerText);
}

function percentMatched(keywords: string[], lowerText: string): number {
  if (keywords.length === 0) return 0;
  const matched = keywords.filter((keyword) => keywordInText(keyword, lowerText)).length;
  return Math.round((matched / keywords.length) * 100);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
