// Batched embedding generation through the Vercel AI Gateway when configured,
// falling back to direct OpenAI. Mirrors lib/llm-routing.ts.
//
// Uses text-embedding-3-small (1536-dim) for cost/quality tradeoff; can be
// overridden via the `model` argument. Batches of 96 inputs per request keep
// well under OpenAI's 2048 cap and the gateway's payload limits.

import { resolveOpenAiAuth, withOpenAiModelPrefix } from "../llm-routing";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_BATCH_SIZE = 96;
const DEFAULT_TIMEOUT_MS = 30_000;

export const EMBEDDING_DIMENSION = 1536;

export type EmbedOptions = {
  model?: string;
  batchSize?: number;
  timeoutMs?: number;
  directKey?: string;
};

export type EmbedResult = {
  embeddings: number[][];
  model: string;
  routedVia: "gateway" | "direct";
};

export async function embedTexts(
  texts: string[],
  options: EmbedOptions = {}
): Promise<EmbedResult> {
  if (texts.length === 0) {
    return { embeddings: [], model: options.model ?? DEFAULT_EMBEDDING_MODEL, routedVia: "direct" };
  }
  const auth = resolveOpenAiAuth(options.directKey);
  if (!auth.apiKey) {
    throw new Error("embedTexts: missing API key (set AI_GATEWAY_API_KEY or OPENAI_API_KEY)");
  }
  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;
  const prefixedModel = withOpenAiModelPrefix(model, auth);
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResult = await embedBatch(batch, {
      baseUrl: auth.baseUrl,
      apiKey: auth.apiKey,
      model: prefixedModel,
      timeoutMs,
    });
    for (let j = 0; j < batchResult.length; j++) {
      out[i + j] = batchResult[j];
    }
  }

  return { embeddings: out, model, routedVia: auth.routedVia };
}

type EmbedBatchArgs = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

async function embedBatch(batch: string[], args: EmbedBatchArgs): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const res = await fetch(`${args.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        input: batch.map((text) => sanitizeForEmbedding(text)),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new Error(`embedTexts: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const data = json.data ?? [];
    if (data.length !== batch.length) {
      throw new Error(`embedTexts: expected ${batch.length} embeddings, got ${data.length}`);
    }
    const ordered: number[][] = new Array(batch.length);
    for (const item of data) {
      const idx = typeof item.index === "number" ? item.index : -1;
      if (idx < 0 || idx >= batch.length || !Array.isArray(item.embedding)) {
        throw new Error("embedTexts: malformed embedding response");
      }
      ordered[idx] = item.embedding;
    }
    return ordered;
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeForEmbedding(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? " " : trimmed.slice(0, 24_000);
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "";
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
