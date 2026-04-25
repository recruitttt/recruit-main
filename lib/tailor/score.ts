// Hybrid tailoring score. Combines:
// (a) the model's self-reported confidence (0-100)
// (b) keyword coverage: percent of (research.requirements + research.techStack)
//     tokens that appear in the tailored resume body.
//
// final = round(0.6 * matchScore + 0.4 * keywordCoveragePercent)

import type { JobResearch, TailoredResume } from "./types";

const STOP_TOKENS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "in",
  "to",
  "for",
  "with",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "be",
  "are",
  "experience",
  "ability",
  "strong",
  "deep",
  "year",
  "years",
  "plus",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+./# -]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

function bodyOfResume(r: TailoredResume): string {
  const parts: string[] = [
    r.headline,
    r.summary,
    r.skills.join(" "),
    r.experience.map((e) => `${e.title} ${e.company} ${e.bullets.join(" ")}`).join(" "),
    r.education.map((e) => `${e.school} ${e.degree ?? ""} ${e.field ?? ""}`).join(" "),
    r.coverLetterBlurb ?? "",
  ];
  return parts.join(" ").toLowerCase();
}

function uniqueKeywords(research: JobResearch): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of [...research.requirements, ...research.techStack]) {
    const tokens = tokenize(phrase);
    for (const t of tokens) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

export function computeKeywordCoverage(
  resume: TailoredResume,
  research: JobResearch
): { coverage: number; matched: string[]; missing: string[] } {
  const keywords = uniqueKeywords(research);
  if (keywords.length === 0) {
    return { coverage: 0, matched: [], missing: [] };
  }
  const body = bodyOfResume(resume);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (body.includes(k)) matched.push(k);
    else missing.push(k);
  }
  return {
    coverage: Math.round((matched.length / keywords.length) * 100),
    matched,
    missing,
  };
}

export function computeTailoringScore(
  resume: TailoredResume,
  research: JobResearch
): { score: number; coverage: number; matched: string[]; missing: string[] } {
  const { coverage, matched, missing } = computeKeywordCoverage(resume, research);
  const matchScore = clamp(resume.tailoringNotes?.confidence ?? 0, 0, 100);
  const score = Math.round(0.6 * matchScore + 0.4 * coverage);
  return { score: clamp(score, 0, 100), coverage, matched, missing };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
