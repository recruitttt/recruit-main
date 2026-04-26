// The research agent. Tries OpenAI's deep-research-capable model first
// (autonomous web search) when available, then falls back to Firecrawl plus
// OpenAI or Gemini/Gemma structured extraction.

import { geminiChatJSON } from "@/lib/gemini";
import { hasK2Credentials, k2ChatJSON } from "@/lib/k2";
import {
  chatJSON,
  chatResponsesJSON,
  extractJSONBlock,
  type ChatMessage,
} from "@/lib/openai";
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
const DEFAULT_OPENAI_RESEARCH_MODEL = "gpt-4o-mini";
const DEFAULT_GEMMA_RESEARCH_MODEL = "gemma-4-26b-a4b-it";

type ResearchProvider = "openai" | "gemini" | "k2";

type ResearchModelConfig = {
  provider: ResearchProvider;
  model: string;
  apiKey: string;
};

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function resolveResearchModelConfig(openAiApiKey?: string): ResearchModelConfig {
  const requestedProvider = cleanEnv(process.env.RESEARCH_PROVIDER).toLowerCase();
  const requestedModel = cleanEnv(process.env.RESEARCH_MODEL);
  const openAiKey =
    cleanEnv(openAiApiKey) ||
    cleanEnv(process.env.OPENAI_API_KEY) ||
    cleanEnv(process.env.AI_GATEWAY_API_KEY);
  const geminiKey = cleanEnv(process.env.GEMINI_API_KEY);
  const explicitK2 =
    requestedProvider === "k2" ||
    requestedProvider === "k2think" ||
    requestedModel.startsWith("k2-") ||
    requestedModel.startsWith("MBZUAI");
  if (explicitK2 || (requestedProvider === "" && !openAiKey && !geminiKey && hasK2Credentials())) {
    return {
      provider: "k2",
      model: requestedModel || cleanEnv(process.env.K2THINK_MODEL) || "MBZUAI-IFM/K2-Think-v2",
      apiKey: cleanEnv(process.env.K2THINK_API_KEY),
    };
  }

  const explicitGemini =
    requestedProvider === "gemini" ||
    requestedProvider === "google" ||
    requestedModel.startsWith("gemma-") ||
    requestedModel.startsWith("gemini-");
  const useGemini =
    explicitGemini ||
    (!openAiKey && geminiKey.length > 0);
  const geminiModel =
    explicitGemini && requestedModel
      ? requestedModel
      : cleanEnv(process.env.GEMMA_RESEARCH_MODEL) ||
        cleanEnv(process.env.GEMMA_TAILOR_MODEL) ||
        DEFAULT_GEMMA_RESEARCH_MODEL;

  if (useGemini) {
    return {
      provider: "gemini",
      model: geminiModel,
      apiKey: geminiKey,
    };
  }

  return {
    provider: "openai",
    model: requestedModel || DEFAULT_OPENAI_RESEARCH_MODEL,
    apiKey: openAiKey,
  };
}

export function hasResearchCredentials(openAiApiKey?: string): boolean {
  return resolveResearchModelConfig(openAiApiKey).apiKey.length > 0;
}

async function chatResearchJSON(
  config: ResearchModelConfig,
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; signal?: AbortSignal }
): ReturnType<typeof chatJSON> {
  if (!config.apiKey) return { ok: false, reason: "no_api_key" };
  const model = opts?.model ?? config.model;
  if (config.provider === "k2") {
    return k2ChatJSON(messages, {
      model,
      temperature: opts?.temperature,
      signal: opts?.signal,
    });
  }
  if (config.provider === "gemini") {
    return geminiChatJSON(config.apiKey, messages, {
      model,
      temperature: opts?.temperature,
      signal: opts?.signal,
    });
  }
  return chatJSON(config.apiKey, messages, {
    model,
    temperature: opts?.temperature,
    signal: opts?.signal,
  });
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function normalize(
  parsed: RawResearch,
  job: Job,
  source: JobResearch["source"],
  modelDurationMs: number
): JobResearch {
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
  const populated = [r.responsibilities, r.requirements, r.techStack].filter(
    (a) => a.length > 0
  ).length;
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
  apiKey?: string,
  signal?: AbortSignal
): Promise<{ ok: true; research: JobResearch } | { ok: false; reason: string }> {
  const config = resolveResearchModelConfig(apiKey);
  const startedAt = Date.now();

  // Prefer the job description captured during ingestion. That keeps the
  // inspection flow consistent and avoids re-scraping when the source text is
  // already available.
  if (job.descriptionPlain && job.descriptionPlain.trim().length > 120) {
    const ingested = await chatResearchJSON(
      config,
      [
        { role: "system", content: RESEARCH_FALLBACK_SYSTEM_PROMPT },
        { role: "user", content: researchFallbackUserPrompt(job, job.descriptionPlain) },
      ],
      {
        model: config.provider === "openai" ? DEFAULT_OPENAI_RESEARCH_MODEL : undefined,
        temperature: 0,
        signal,
      }
    );

    if (ingested.ok) {
      const parsed = safeParse(ingested.raw);
      if (parsed) {
        return {
          ok: true,
          research: normalize(parsed, job, "ingested-description", Date.now() - startedAt),
        };
      }
    }
  }

  // Pass 1: deep research (autonomous web search — OpenAI Responses API)
  // or K2 Think V2 reasoning (structured extraction from job context).
  if (config.provider === "k2" && config.apiKey) {
    const k2Research = await chatResearchJSON(
      config,
      [
        { role: "system", content: RESEARCH_SYSTEM_PROMPT },
        {
          role: "user",
          content: researchUserPrompt(job) +
            "\n\nThink step by step about this role. Reason through each layer: the job requirements, the company context, and the culture signals. Then produce the JSON.",
        },
      ],
      { temperature: 0, signal }
    );

    if (k2Research.ok) {
      const parsed = safeParse(k2Research.raw);
      if (parsed) {
        const research = normalize(parsed, job, "k2-reasoning", Date.now() - startedAt);
        if (!isThin(research)) {
          return { ok: true, research };
        }
      }
    }
  }

  if (config.provider === "openai" && config.apiKey) {
    const deepResearch = await chatResponsesJSON(
      config.apiKey,
      RESEARCH_SYSTEM_PROMPT,
      researchUserPrompt(job),
      { model: config.model, signal }
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

  const fallback = await chatResearchJSON(
    config,
    [
      { role: "system", content: RESEARCH_FALLBACK_SYSTEM_PROMPT },
      { role: "user", content: researchFallbackUserPrompt(job, scrape.markdown) },
    ],
    {
      model: config.provider === "openai" ? DEFAULT_OPENAI_RESEARCH_MODEL : undefined,
      temperature: 0,
      signal,
    }
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
