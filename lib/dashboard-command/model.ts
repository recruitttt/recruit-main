import { extractJSONBlock, type ChatMessage } from "@/lib/openai";
import { DASHBOARD_COMMAND_SYSTEM_PROMPT, buildDashboardCommandUserPrompt } from "./prompt";
import {
  DashboardCommandResponseSchema,
  type DashboardCommandModelResult,
  type DashboardCommandRequest,
  type DashboardCommandResponse,
} from "./types";

type OpenAICompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  detail?: string;
  message?: string;
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
  detail?: string;
  message?: string;
};

const DEFAULT_K2_BASE_URL = "https://api.k2think.ai/v1";
const DEFAULT_K2_MODEL = "MBZUAI-IFM/K2-Think-v2";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";
const DEFAULT_K2_TIMEOUT_MS = 5000;
const DEFAULT_ANTHROPIC_TIMEOUT_MS = 12000;

export async function runDashboardCommand(
  input: DashboardCommandRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DashboardCommandModelResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: DASHBOARD_COMMAND_SYSTEM_PROMPT },
    { role: "user", content: buildDashboardCommandUserPrompt(input) },
  ];

  const k2Config = readK2Config(env);
  if (!k2Config) {
    const fallback = localDashboardCommand(input);
    return {
      ok: true,
      value: fallback,
      raw: JSON.stringify(fallback),
      provider: "demo",
      modelId: "k2-think-v2-local-demo",
      fallbackUsed: true,
    };
  }

  const providerAttempts: Array<{ provider: string; reason: string }> = [];
  const result = await callK2DashboardCommand(k2Config, messages);
  if (result.ok) {
    return {
      ok: true,
      value: result.value,
      raw: result.raw,
      provider: "k2",
      modelId: k2Config.model,
      fallbackUsed: false,
    };
  }
  providerAttempts.push({ provider: "k2", reason: result.reason });

  const anthropicConfig = readAnthropicConfig(env);
  if (anthropicConfig) {
    const fallback = await callAnthropicDashboardCommand(anthropicConfig, messages);
    if (fallback.ok) {
      return {
        ok: true,
        value: fallback.value,
        raw: fallback.raw,
        provider: "anthropic",
        modelId: `anthropic/${anthropicConfig.model}`,
        fallbackUsed: true,
      };
    }
    providerAttempts.push({ provider: "anthropic", reason: fallback.reason });
  }

  return {
    ok: false,
    reason: providerAttempts[providerAttempts.length - 1]?.reason ?? result.reason,
    providerAttempts,
  };
}

export function parseDashboardCommand(raw: string):
  | { ok: true; value: DashboardCommandResponse }
  | { ok: false; reason: string } {
  const candidates = [
    extractJSONBlock(raw),
    ...extractJsonObjectCandidates(stripReasoningBlock(raw)).reverse(),
    ...extractJsonObjectCandidates(raw).reverse(),
  ];
  let lastError = "no_json_object";

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        ok: true,
        value: DashboardCommandResponseSchema.parse(normalizeDashboardCommandCandidate(parsed)),
      };
    } catch (err) {
      lastError = errorMessage(err);
    }
  }

  return { ok: false, reason: `invalid_model_json: ${lastError}` };
}

function normalizeDashboardCommandCandidate(parsed: unknown) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;

  const candidate = { ...(parsed as Record<string, unknown>) };
  const reorder = candidate.reorder;
  if (!reorder || typeof reorder !== "object" || Array.isArray(reorder)) return candidate;

  const reorderObject = reorder as Record<string, unknown>;
  const jobIds = Array.isArray(reorderObject.jobIds)
    ? reorderObject.jobIds.filter((jobId): jobId is string =>
        typeof jobId === "string" && jobId.trim().length > 0
      )
    : [];
  const reason = typeof reorderObject.reason === "string" ? reorderObject.reason.trim() : "";

  candidate.reorder = jobIds.length > 0
    ? { ...reorderObject, jobIds, reason: reason || "Model returned an ordered shortlist." }
    : null;

  return candidate;
}

function stripReasoningBlock(raw: string) {
  const closingTag = raw.lastIndexOf("</think>");
  return closingTag === -1 ? raw : raw.slice(closingTag + "</think>".length);
}

function extractJsonObjectCandidates(raw: string) {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = inString;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidates.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function readK2Config(env: NodeJS.ProcessEnv) {
  const apiKey = env.K2_API_KEY ?? env.K2_THINK_API_KEY ?? env.K2THINK_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: (env.K2_BASE_URL ?? env.K2_THINK_BASE_URL ?? env.K2THINK_BASE_URL ?? DEFAULT_K2_BASE_URL).replace(/\/+$/, ""),
    model: env.K2_MODEL ?? env.K2_THINK_MODEL ?? env.K2THINK_MODEL ?? DEFAULT_K2_MODEL,
    timeoutMs: positiveInt(env.K2_DASHBOARD_COMMAND_TIMEOUT_MS) ?? DEFAULT_K2_TIMEOUT_MS,
  };
}

function readAnthropicConfig(env: NodeJS.ProcessEnv) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: (env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE_URL).replace(/\/+$/, ""),
    model: env.ANTHROPIC_DASHBOARD_COMMAND_MODEL ?? env.CLAUDE_DASHBOARD_COMMAND_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    timeoutMs: positiveInt(env.ANTHROPIC_DASHBOARD_COMMAND_TIMEOUT_MS) ?? DEFAULT_ANTHROPIC_TIMEOUT_MS,
  };
}

async function callK2DashboardCommand(
  config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
  messages: ChatMessage[],
): Promise<{ ok: true; raw: string; value: DashboardCommandResponse } | { ok: false; reason: string }> {
  return callDashboardCommandProvider(messages, (conversation) =>
    callOpenAICompatibleJSON(config, conversation)
  );
}

async function callAnthropicDashboardCommand(
  config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
  messages: ChatMessage[],
): Promise<{ ok: true; raw: string; value: DashboardCommandResponse } | { ok: false; reason: string }> {
  return callDashboardCommandProvider(messages, (conversation) =>
    callAnthropicJSON(config, conversation)
  );
}

async function callDashboardCommandProvider(
  messages: ChatMessage[],
  callModel: (messages: ChatMessage[]) => Promise<{ ok: true; raw: string } | { ok: false; reason: string }>,
): Promise<{ ok: true; raw: string; value: DashboardCommandResponse } | { ok: false; reason: string }> {
  let conversation = [...messages];
  let parseReason = "invalid_model_json";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await callModel(conversation);
    if (!result.ok) return result;

    const parsed = parseDashboardCommand(result.raw);
    if (parsed.ok) {
      return { ok: true, raw: result.raw, value: parsed.value };
    }

    parseReason = parsed.reason;
    if (attempt < 3) {
      conversation = [
        ...conversation,
        { role: "assistant", content: result.raw },
        {
          role: "user",
          content: `Your previous response was invalid. Problem: ${parseReason}. Return only valid JSON matching the required response schema.`,
        },
      ];
    }
  }

  return { ok: false, reason: parseReason };
}

async function callAnthropicJSON(
  config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
  messages: ChatMessage[],
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  let timedOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  try {
    const { system, apiMessages } = toAnthropicMessages(messages);
    const res = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1400,
        temperature: 0,
        system,
        messages: apiMessages,
      }),
    });

    const json = (await res.json()) as AnthropicResponse;
    if (!res.ok || json.error) {
      return {
        ok: false,
        reason: json.error?.message ?? json.detail ?? json.message ?? `anthropic_${res.status}`,
      };
    }

    const raw = json.content
      ?.filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();
    return { ok: true, raw: raw || "{}" };
  } catch (err) {
    if (timedOut) return { ok: false, reason: `anthropic_timeout_after_${config.timeoutMs}ms` };
    return { ok: false, reason: errorMessage(err) };
  } finally {
    clearTimeout(timeout);
  }
}

function toAnthropicMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const apiMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  return { system, apiMessages };
}

async function callOpenAICompatibleJSON(
  config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
  messages: ChatMessage[],
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  let timedOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        temperature: 0.1,
        chat_template_kwargs: { reasoning_effort: "high" },
        messages,
      }),
    });

    const json = (await res.json()) as OpenAICompatibleResponse;
    if (!res.ok || json.error) {
      return {
        ok: false,
        reason: json.error?.message ?? json.detail ?? json.message ?? `k2_${res.status}`,
      };
    }
    return { ok: true, raw: json.choices?.[0]?.message?.content ?? "{}" };
  } catch (err) {
    if (timedOut) return { ok: false, reason: `k2_timeout_after_${config.timeoutMs}ms` };
    return { ok: false, reason: errorMessage(err) };
  } finally {
    clearTimeout(timeout);
  }
}

function positiveInt(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 240);
  return String(err).slice(0, 240);
}

function localDashboardCommand(input: DashboardCommandRequest): DashboardCommandResponse {
  const prompt = input.prompt.toLowerCase();
  const jobs = input.context.jobs;
  const filters: DashboardCommandResponse["filters"] = [];
  const excludeMode = /\b(?:remove|exclude|hide|avoid|skip|without|no|hate|not interested in|don't show|dont show)\b/.test(prompt);

  const minScore = prompt.match(/(?:over|above|>=|at least)\s+(\d{2,3})/);
  if (minScore) {
    filters.push({
      field: "score",
      op: "gte",
      value: Math.max(0, Math.min(100, Number(minScore[1]))),
      label: `Score ${minScore[1]}+`,
    });
  }
  if (prompt.includes("remote")) {
    filters.push({
      field: "location",
      op: "contains",
      value: "remote",
      label: "Remote roles",
    });
  }
  if (prompt.includes("hide") && (prompt.includes("ruled") || prompt.includes("low"))) {
    filters.push({
      field: "statusLabel",
      op: "not_contains",
      value: "Ruled out",
      label: "Hide ruled-out roles",
    });
  }
  if (excludeMode) {
    for (const companyFilter of companyExclusionFilters(input.context.jobs, prompt)) {
      if (!filters.some((filter) =>
        filter.field === companyFilter.field &&
        filter.op === companyFilter.op &&
        String(filter.value).toLowerCase() === String(companyFilter.value).toLowerCase()
      )) {
        filters.push(companyFilter);
      }
    }
  }

  for (const keyword of ["agent", "infrastructure", "platform", "research", "product", "inference", "ai"]) {
    if (prompt.includes(keyword)) {
      filters.push({
        field: "title",
        op: "contains",
        value: keyword,
        label: `Prioritize ${keyword}`,
      });
    }
  }

  const filtered = jobs.filter((job) => passesLocalFilters(job, filters));
  const ordered = [...filtered].sort((left, right) =>
    localBoost(right, prompt, input.context.selectedJobId) -
      localBoost(left, prompt, input.context.selectedJobId) ||
    (right.score ?? 0) - (left.score ?? 0) ||
    (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
  );
  const top = ordered.slice(0, 3);
  const intent: DashboardCommandResponse["intent"] =
    prompt.includes("why") || prompt.includes("explain")
      ? "explain"
      : prompt.includes("reset") || prompt.includes("clear")
        ? "clear"
        : filters.length > 0
          ? "filter"
          : prompt.includes("compare") || prompt.includes("rank") || prompt.includes("prioritize")
            ? "reorder"
            : "summarize";

  return {
    intent,
    answer: localAnswer(input.prompt, top, filters, filtered.length),
    filters,
    reorder: ordered.length > 0
      ? {
          jobIds: ordered.map((job) => job.jobId),
          reason: "Sponsor-demo reasoning applied score, command keywords, and selected job context.",
        }
      : null,
    explanations: top.map((job, index) => ({
      jobId: job.jobId,
      summary: job.rationale ?? `${job.company ?? "This company"} is shortlist item ${index + 1} for the command.`,
      evidence: [
        job.score !== undefined ? `Fit score ${Math.round(job.score)}` : undefined,
        job.compensationSummary,
        job.strengths?.[0],
      ].filter((item): item is string => Boolean(item)).slice(0, 3),
    })),
    suggestedChips: [
      "Only remote roles above 80",
      "Explain top fit",
      "Prioritize agent infrastructure",
      "Compare risk",
    ],
  };
}

function passesLocalFilters(
  job: DashboardCommandRequest["context"]["jobs"][number],
  filters: DashboardCommandResponse["filters"],
) {
  for (const filter of filters) {
    if (filter.field === "score" && filter.op === "gte" && typeof filter.value === "number") {
      if ((job.score ?? 0) < filter.value) return false;
    }
    if (filter.field === "location" && filter.op === "contains") {
      if (!String(job.location ?? "").toLowerCase().includes(String(filter.value).toLowerCase())) return false;
    }
    if (filter.field === "statusLabel" && filter.op === "not_contains") {
      if (String(job.statusLabel ?? "").toLowerCase().includes(String(filter.value).toLowerCase())) return false;
    }
    if (filter.field === "company" && filter.op === "not_contains") {
      if (String(job.company ?? "").toLowerCase().includes(String(filter.value).toLowerCase())) return false;
    }
    if (filter.field === "title" && filter.op === "contains") {
      const haystack = [
        job.title,
        job.company,
        job.rationale,
        job.compensationSummary,
        ...(job.strengths ?? []),
        ...(job.tags ?? []),
      ].join(" ").toLowerCase();
      if (!haystack.includes(String(filter.value).toLowerCase())) return false;
    }
  }
  return true;
}

function companyExclusionFilters(
  jobs: DashboardCommandRequest["context"]["jobs"],
  prompt: string,
): DashboardCommandResponse["filters"] {
  const filters: DashboardCommandResponse["filters"] = [];
  const seen = new Set<string>();

  for (const job of jobs) {
    const company = job.company?.trim();
    if (!company) continue;
    const match = companyPromptMatch(company, prompt);
    if (!match || seen.has(match.value)) continue;
    seen.add(match.value);
    filters.push({
      field: "company",
      op: "not_contains",
      value: match.value,
      label: `Hide ${match.label}`,
    });
  }

  return filters;
}

function companyPromptMatch(company: string, prompt: string): { value: string; label: string } | null {
  const normalizedCompany = company.toLowerCase();
  if (prompt.includes(normalizedCompany)) {
    return { value: normalizedCompany, label: company };
  }

  const tokens = company
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    if (new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, "i").test(prompt)) {
      return { value: normalizedToken, label: token };
    }
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localBoost(
  job: DashboardCommandRequest["context"]["jobs"][number],
  prompt: string,
  selectedJobId?: string | null,
) {
  let value = job.score ?? 0;
  if (selectedJobId && job.jobId === selectedJobId) value += 1;
  const haystack = [
    job.title,
    job.company,
    job.rationale,
    job.compensationSummary,
    ...(job.strengths ?? []),
    ...(job.tags ?? []),
  ].join(" ").toLowerCase();
  for (const keyword of ["agent", "infrastructure", "platform", "research", "product", "inference", "ai"]) {
    if (prompt.includes(keyword) && haystack.includes(keyword)) value += 8;
  }
  if (prompt.includes("risk") && job.risks?.length) value += 2;
  return value;
}

function localAnswer(
  prompt: string,
  jobs: DashboardCommandRequest["context"]["jobs"],
  filters: DashboardCommandResponse["filters"],
  matchCount: number,
) {
  if (jobs.length === 0) {
    return filters.length > 0
      ? `Applied ${filters.map((filter) => filter.label).join(", ")}. No matching roles remain.`
      : "No matching roles found.";
  }
  const top = jobs[0];
  if (filters.length > 0) {
    const roleText = matchCount === 1 ? "1 role remains" : `${matchCount} roles remain`;
    return `Applied ${filters.map((filter) => filter.label).join(", ")}. ${roleText}; ${top.company ?? "the top role"} is currently first.`;
  }
  return `Interpreted "${prompt}" and put ${top.company ?? "the top role"} first because it has the strongest visible fit signal.`;
}
