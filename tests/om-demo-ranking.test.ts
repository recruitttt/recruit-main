import assert from "node:assert/strict";

import { GET as getDashboardLive } from "../app/api/dashboard/live/route";
import { POST as postRunFirst3 } from "../app/api/dashboard/run-first-3/route";
import type { UserProfile } from "../lib/profile";
import { jsonRequest, withEnvAsync } from "./helpers";

const runDemoRanker = postRunFirst3 as (request: Request) => Promise<Response>;

function profileFor(companyFocus: "deepmind" | "anthropic"): UserProfile {
  const deepmind = companyFocus === "deepmind";
  return {
    name: deepmind ? "Gemini Candidate" : "Claude Candidate",
    email: "candidate@example.com",
    location: "San Francisco, CA",
    headline: deepmind
      ? "Research engineer for Gemini evaluation infrastructure"
      : "AI product engineer for Claude workflow tools",
    summary: deepmind
      ? "Builds JAX, Python, Kubernetes, multimodal evaluation, and Gemini agent infrastructure for frontier model teams."
      : "Builds TypeScript, React, Claude, constitutional AI, safety tooling, and human-in-the-loop AI workflow products.",
    links: {},
    resume: {
      filename: "candidate.txt",
      uploadedAt: "2026-04-26T00:00:00.000Z",
      rawText: deepmind
        ? "Google DeepMind Gemini JAX Python evals model quality Kubernetes research systems."
        : "Anthropic Claude TypeScript React safety workflows applied AI products.",
    },
    experience: [
      {
        company: deepmind ? "Gemini Systems" : "Claude Tools",
        title: deepmind ? "Research Infrastructure Engineer" : "Product Engineer",
        description: deepmind
          ? "Owned model evaluation services using JAX, Python, and Kubernetes."
          : "Shipped Claude workflow UIs using React, TypeScript, and safety review tooling.",
      },
    ],
    education: [],
    skills: deepmind
      ? ["JAX", "Python", "Kubernetes", "Gemini", "model evaluation"]
      : ["Claude", "React", "TypeScript", "AI safety", "product engineering"],
    prefs: {
      roles: deepmind
        ? ["Research Engineer", "AI Infrastructure Engineer"]
        : ["Product Engineer", "Full Stack Engineer"],
      locations: ["San Francisco", "Remote"],
    },
    suggestions: [],
    provenance: {},
    log: [],
    updatedAt: "2026-04-26T00:00:00.000Z",
  };
}

async function rankedCompanies(profile: UserProfile): Promise<{ body: Record<string, unknown>; companies: string[] }> {
  const response = await runDemoRanker(
    jsonRequest({ profile }, "http://test.local/api/dashboard/run-first-3")
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  const recommendations = body.recommendations as Array<{ company?: string }> | undefined;
  assert.ok(Array.isArray(recommendations), "fixture run-first-3 should return ranked demo recommendations");
  assert.equal(recommendations.length, 9, "all linked OM demo jobs should stay in the ranked pool");
  assert.match(
    String((body.ranking as { scoringMode?: string } | undefined)?.scoringMode ?? ""),
    /^v2_/,
    "demo recommendations should be produced by the v2 hybrid ranker"
  );
  return {
    body,
    companies: recommendations.slice(0, 8).map((recommendation) => recommendation.company ?? ""),
  };
}

async function main() {
  await withEnvAsync(
    {
      DASHBOARD_DATA_SOURCE: "fixture",
      NEXT_PUBLIC_CONVEX_URL: undefined,
      AI_GATEWAY_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      COHERE_API_KEY: undefined,
    },
    async () => {
      const deepmind = await rankedCompanies(profileFor("deepmind"));
      const anthropic = await rankedCompanies(profileFor("anthropic"));

      assert.notDeepEqual(
        deepmind.companies,
        anthropic.companies,
        "hardcoded demo job order must depend on resume/profile/LinkedIn/GitHub text"
      );
      assert.ok(
        deepmind.companies.every((company) =>
          ["Google DeepMind", "Apple", "NVIDIA", "OpenAI", "Meta", "Microsoft AI", "Amazon AGI", "Anthropic", "Tesla"].includes(company)
        ),
        "ranked demo companies should come from linked OM frontier recommendations"
      );
      assert.equal(deepmind.companies[0], "Google DeepMind");
      assert.equal(anthropic.companies[0], "Anthropic");

      const liveAfterPost = await getDashboardLive(new Request("http://test.local/api/dashboard/live"));
      assert.equal(liveAfterPost.status, 200);
      const liveBody = await liveAfterPost.json() as {
        recommendations?: Array<{ company?: string }>;
      };
      assert.equal(
        liveBody.recommendations?.[0]?.company,
        "Anthropic",
        "dashboard live refresh should preserve the latest profile-specific fixture ranking"
      );
    }
  );

  console.log("om demo ranking tests passed");
}

main().catch((err) => {
  console.error("om demo ranking tests failed:", err);
  process.exit(1);
});
