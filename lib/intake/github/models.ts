import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type ModelTier = "fast" | "deep";

const FAST_ID = "claude-haiku-4-5";
const DEEP_ID = "claude-sonnet-4-6";

export interface AICredentials {
  source: "gateway" | "anthropic";
  apiKey: string;
}

export function detectCredentials(env: NodeJS.ProcessEnv = process.env): AICredentials | null {
  if (env.AI_GATEWAY_API_KEY) return { source: "gateway", apiKey: env.AI_GATEWAY_API_KEY };
  if (env.ANTHROPIC_API_KEY) return { source: "anthropic", apiKey: env.ANTHROPIC_API_KEY };
  return null;
}

export function pickModel(tier: ModelTier, creds: AICredentials): { model: LanguageModel; modelId: string } {
  const id = tier === "fast" ? FAST_ID : DEEP_ID;
  if (creds.source === "gateway") {
    return { model: `anthropic/${id}` as unknown as LanguageModel, modelId: `anthropic/${id}` };
  }
  return { model: anthropic(id), modelId: `anthropic/${id}` };
}
