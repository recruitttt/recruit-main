import type { AICredentials } from "../shared/types";

type RuntimeEnv = Record<string, string | undefined>;

export interface LinkedInBrowserbaseConfig {
  apiKey: string;
  projectId: string;
  reuseSessionId?: string;
}

export interface LinkedInLoginConfig {
  email?: string;
  password?: string;
  liAt?: string;
}

export interface LinkedInSharedRuntimeConfig {
  browserbase?: Partial<LinkedInBrowserbaseConfig> | null;
  linkedin?: Partial<LinkedInLoginConfig> | null;
  ai?: Partial<AICredentials> | null;
}

export function resolveLinkedInBrowserbaseConfig(
  env: RuntimeEnv,
  shared: LinkedInSharedRuntimeConfig | null | undefined,
): LinkedInBrowserbaseConfig {
  const apiKey = firstNonEmpty(shared?.browserbase?.apiKey, env.BROWSERBASE_API_KEY);
  const projectId = firstNonEmpty(shared?.browserbase?.projectId, env.BROWSERBASE_PROJECT_ID);
  const reuseSessionId = firstNonEmpty(
    shared?.browserbase?.reuseSessionId,
    env.BROWSERBASE_SESSION_ID,
  );

  if (!apiKey || !projectId) {
    throw new Error(
      "Browserbase credentials are not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in Convex env.",
    );
  }

  return { apiKey, projectId, reuseSessionId };
}

export function resolveLinkedInLoginConfig(
  env: RuntimeEnv,
  shared: LinkedInSharedRuntimeConfig | null | undefined,
): LinkedInLoginConfig {
  return {
    email: firstNonEmpty(shared?.linkedin?.email, env.LINKEDIN_EMAIL),
    password: firstNonEmpty(shared?.linkedin?.password, env.LINKEDIN_PASSWORD),
    liAt: firstNonEmpty(shared?.linkedin?.liAt, env.LINKEDIN_LI_AT),
  };
}

export function resolveLinkedInAiCredentials(
  env: RuntimeEnv,
  shared: LinkedInSharedRuntimeConfig | null | undefined,
): AICredentials {
  const sharedSource = shared?.ai?.source;
  const sharedApiKey = firstNonEmpty(shared?.ai?.apiKey);
  if ((sharedSource === "gateway" || sharedSource === "anthropic") && sharedApiKey) {
    return { source: sharedSource, apiKey: sharedApiKey };
  }

  const gateway = firstNonEmpty(env.AI_GATEWAY_API_KEY);
  if (gateway) return { source: "gateway", apiKey: gateway };

  const anthropic = firstNonEmpty(env.ANTHROPIC_API_KEY);
  if (anthropic) return { source: "anthropic", apiKey: anthropic };

  throw new Error(
    "No AI credentials configured. Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in Convex env.",
  );
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return undefined;
}
