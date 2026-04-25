// The research agent. Tries OpenAI's deep-research-capable model first
// (autonomous web search), falls back to a Firecrawl scrape + structured
// extraction call if the deep research returns thin content.

import { chatJSON, chatResponsesJSON, extractJSONBlock } from "@/lib/openai";
import { scrapeWithFallback } from "@/lib/scrapers/server";
import {
  RESEARCH_FALLBACK_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  researchFallbackUserPrompt,
  researchUserPrompt,
} from "./prompt";
import type { Job, JobResearch } from "./types";

type RawResearch = {
  jdSummary?: string;
  responsibilities?: string[];
  requirements?: string[];
  niceToHaves?: string[];
  techStack?: string[];
  companyMission?: string;
  companyProducts?: string[];
  cultureSignals?: string[];
  recentNews?: string[];
};

const MIN_USEFUL_FIELDS = 1; // need at least 1 of (responsibilities, requirements, techStack) populated

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function normalize(parsed: RawResearch, job: Job, source: JobResearch["source"], modelDurationMs: number): JobResearch {
  return {
    jobUrl: job.jobUrl,
    company: job.company,
    role: job.role,
    jdSummary: typeof parsed.jdSummary === "string" ? parsed.jdSummary : "",
    responsibilities: asStringArray(parsed.responsibilities),
    requirements: asStringArray(parsed.requirements),
    niceToHaves: asStringArray(parsed.niceToHaves),
    techStack: asStringArray(parsed.techStack),
    companyMission: typeof parsed.companyMission === "string" ? parsed.companyMission : "",
    companyProducts: asStringArray(parsed.companyProducts),
    cultureSignals: asStringArray(parsed.cultureSignals),
    recentNews: asStringArray(parsed.recentNews),
    source,
    modelDurationMs,
  };
}

function isThin(r: JobResearch): boolean {
  const populated = [r.responsibilities, r.requirements, r.techStack].filter((a) => a.length > 0).length;
  return populated < MIN_USEFUL_FIELDS;
}

function safeParse(raw: string): RawResearch | null {
  try {
    return JSON.parse(extractJSONBlock(raw)) as RawResearch;
  } catch {
    return null;
  }
}

export async function researchJob(
  job: Job,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ ok: true; research: JobResearch } | { ok: false; reason: string }> {
  const model = process.env.RESEARCH_MODEL ?? "gpt-4o-mini";
  const startedAt = Date.now();

  // Pass 1: deep research (autonomous web search).
  const deepResearch = await chatResponsesJSON(
    apiKey,
    RESEARCH_SYSTEM_PROMPT,
    researchUserPrompt(job),
    { model, signal }
  );

  if (deepResearch.ok) {
    const parsed = safeParse(deepResearch.raw);
    if (parsed) {
      const research = normalize(parsed, job, "deep-research", Date.now() - startedAt);
      if (!isThin(research)) {
        return { ok: true, research };
      }
    }
  }

  // Pass 2: fallback. Scrape the JD page directly, then extract structure.
  const scrape = await scrapeWithFallback(job.jobUrl, signal);
  if (!scrape.ok) {
    // Last resort: title-only research. The model gets just {company, role}.
    const titleOnly = normalize(
      {
        jdSummary: `${job.role} role at ${job.company}.`,
        responsibilities: [],
        requirements: [],
        niceToHaves: [],
        techStack: [],
        companyMission: "",
        companyProducts: [],
        cultureSignals: [],
        recentNews: [],
      },
      job,
      "title-only",
      Date.now() - startedAt
    );
    return { ok: true, research: titleOnly };
  }

  const fallback = await chatJSON(
    apiKey,
    [
      { role: "system", content: RESEARCH_FALLBACK_SYSTEM_PROMPT },
      { role: "user", content: researchFallbackUserPrompt(job, scrape.markdown) },
    ],
    { model: "gpt-4o-mini", temperature: 0, signal }
  );

  if (!fallback.ok) {
    return { ok: false, reason: `research_fallback_failed: ${fallback.reason}` };
  }

  const parsed = safeParse(fallback.raw);
  if (!parsed) {
    return { ok: false, reason: "research_parse_failed" };
  }

  return {
    ok: true,
    research: normalize(parsed, job, "firecrawl-fallback", Date.now() - startedAt),
  };
}
