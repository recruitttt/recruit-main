import assert from "node:assert/strict";

import {
  resolveLinkedInAiCredentials,
  resolveLinkedInBrowserbaseConfig,
  resolveLinkedInLoginConfig,
} from "../lib/intake/linkedin/runtime-config";

const emptyEnv = {};

const convexConfig = {
  browserbase: {
    apiKey: "bb_convex",
    projectId: "proj_convex",
    reuseSessionId: "session_convex",
  },
  linkedin: {
    email: "convex@example.com",
    password: "convex-password",
    liAt: "convex-cookie",
  },
  ai: {
    source: "anthropic" as const,
    apiKey: "anthropic_convex",
  },
};

assert.deepEqual(
  resolveLinkedInBrowserbaseConfig(emptyEnv, convexConfig),
  convexConfig.browserbase,
);
assert.deepEqual(
  resolveLinkedInLoginConfig(emptyEnv, convexConfig),
  convexConfig.linkedin,
);
assert.deepEqual(
  resolveLinkedInAiCredentials(emptyEnv, convexConfig),
  convexConfig.ai,
);

assert.deepEqual(
  resolveLinkedInBrowserbaseConfig(
    {
      BROWSERBASE_API_KEY: "bb_local",
      BROWSERBASE_PROJECT_ID: "proj_local",
    },
    convexConfig,
  ),
  convexConfig.browserbase,
);

assert.deepEqual(
  resolveLinkedInLoginConfig(
    {
      LINKEDIN_EMAIL: "local@example.com",
      LINKEDIN_PASSWORD: "local-password",
    },
    convexConfig,
  ),
  convexConfig.linkedin,
);

assert.deepEqual(
  resolveLinkedInAiCredentials(
    { AI_GATEWAY_API_KEY: "gateway_local", ANTHROPIC_API_KEY: "anthropic_local" },
    convexConfig,
  ),
  convexConfig.ai,
);

assert.deepEqual(
  resolveLinkedInBrowserbaseConfig(
    {
      BROWSERBASE_API_KEY: "bb_local",
      BROWSERBASE_PROJECT_ID: "proj_local",
    },
    {},
  ),
  { apiKey: "bb_local", projectId: "proj_local", reuseSessionId: undefined },
);

assert.throws(
  () => resolveLinkedInBrowserbaseConfig(emptyEnv, {}),
  /Browserbase credentials/i,
);
assert.throws(
  () => resolveLinkedInAiCredentials(emptyEnv, {}),
  /AI credentials/i,
);

console.log("linkedin runtime config test passed");
