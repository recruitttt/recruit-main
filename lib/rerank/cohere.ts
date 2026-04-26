// Cohere Rerank v3 integration. Direct API by default; routed through the
// Vercel AI Gateway when AI_GATEWAY_API_KEY is set and the gateway is
// configured to passthrough Cohere rerank.
//
// One call per ranking run — Cohere accepts up to 1000 docs and returns
// relevance scores in [0, 1]. On failure, callers should fall back to the
// pre-rerank ordering (do not throw out of the ranker for rerank failure).

const COHERE_DIRECT_BASE = "https://api.cohere.com/v1";
const VERCEL_GATEWAY_RERANK_BASE = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_RERANK_MODEL = "rerank-english-v3.0";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_DOCS = 1000;

export type RerankDoc = {
  id: string;
  text: string;
};

export type RerankedItem = {
  id: string;
  index: number;
  relevance: number;
};

export type RerankOptions = {
  model?: string;
  topK?: number;
  timeoutMs?: number;
  directKey?: string;
};

export type RerankResult = {
  results: RerankedItem[];
  model: string;
  routedVia: "gateway" | "direct";
};

type CohereAuth = {
  baseUrl: string;
  apiKey: string;
  routedVia: "gateway" | "direct";
};

function resolveCohereAuth(directKey?: string): CohereAuth | null {
  // Prefer direct Cohere when COHERE_API_KEY is present — the AI Gateway
  // does not expose Cohere's /rerank endpoint with a stable shape, so a
  // direct key is more reliable. Fall back to gateway only when no direct
  // key is set.
  const cohereDirect = directKey ?? process.env.COHERE_API_KEY ?? "";
  if (cohereDirect.length > 0) {
    return { baseUrl: COHERE_DIRECT_BASE, apiKey: cohereDirect, routedVia: "direct" };
  }
  const gateway = process.env.AI_GATEWAY_API_KEY;
  if (gateway && gateway.length > 0) {
    return { baseUrl: VERCEL_GATEWAY_RERANK_BASE, apiKey: gateway, routedVia: "gateway" };
  }
  return null;
}

export async function rerankCandidates(
  query: string,
  docs: RerankDoc[],
  options: RerankOptions = {}
): Promise<RerankResult> {
  if (docs.length === 0) {
    return { results: [], model: options.model ?? DEFAULT_RERANK_MODEL, routedVia: "direct" };
  }
  const auth = resolveCohereAuth(options.directKey);
  if (!auth) {
    throw new Error("rerankCandidates: no auth available (set AI_GATEWAY_API_KEY or COHERE_API_KEY)");
  }
  const truncatedDocs = docs.slice(0, MAX_DOCS);
  const model = options.model ?? DEFAULT_RERANK_MODEL;
  const topK = Math.min(options.topK ?? truncatedDocs.length, truncatedDocs.length);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${auth.baseUrl}/rerank`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      body: JSON.stringify({
        model,
        query: sanitize(query),
        documents: truncatedDocs.map((doc) => sanitize(doc.text)),
        top_n: topK,
        return_documents: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(`rerankCandidates: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
    }
    const json = (await res.json()) as {
      results?: Array<{ index?: number; relevance_score?: number }>;
    };
    const raw = json.results ?? [];
    const results: RerankedItem[] = raw
      .map((item) => {
        const index = typeof item.index === "number" ? item.index : -1;
        const relevance =
          typeof item.relevance_score === "number" ? item.relevance_score : 0;
        if (index < 0 || index >= truncatedDocs.length) return null;
        return { id: truncatedDocs[index].id, index, relevance };
      })
      .filter((r): r is RerankedItem => r !== null);
    return { results, model, routedVia: auth.routedVia };
  } finally {
    clearTimeout(timer);
  }
}

function sanitize(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? " " : trimmed.slice(0, 8_000);
}
