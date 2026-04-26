// Routes direct REST calls to OpenAI through Vercel AI Gateway when
// AI_GATEWAY_API_KEY is set. Falls back to api.openai.com with the
// caller-provided OPENAI_API_KEY otherwise.
//
// The AI Gateway exposes an OpenAI-compatible endpoint at
// https://ai-gateway.vercel.sh/v1; the model field must be
// provider-prefixed (e.g. "openai/gpt-4o-mini").
//
// LLM calls already going through the AI SDK (`@ai-sdk/anthropic`,
// `streamText`, etc.) don't need this helper — they pick up gateway
// routing automatically when AI_GATEWAY_API_KEY is set, via the
// existing pickModel abstraction in lib/intake/github/models.ts.

const OPENAI_DIRECT_BASE = "https://api.openai.com/v1";
const VERCEL_GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";

export type OpenAiAuth = {
  baseUrl: string;
  apiKey: string;
  modelPrefix: string;
  routedVia: "gateway" | "direct";
};

export function resolveOpenAiAuth(directKey?: string): OpenAiAuth {
  const gateway = process.env.AI_GATEWAY_API_KEY;
  if (gateway && gateway.length > 0) {
    return {
      baseUrl: VERCEL_GATEWAY_BASE,
      apiKey: gateway,
      modelPrefix: "openai/",
      routedVia: "gateway",
    };
  }
  return {
    baseUrl: OPENAI_DIRECT_BASE,
    apiKey: directKey ?? process.env.OPENAI_API_KEY ?? "",
    modelPrefix: "",
    routedVia: "direct",
  };
}

export function withOpenAiModelPrefix(model: string, auth: OpenAiAuth): string {
  if (auth.modelPrefix && !model.includes("/")) {
    return `${auth.modelPrefix}${model}`;
  }
  return model;
}
