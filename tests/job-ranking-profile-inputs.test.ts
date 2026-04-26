import assert from "node:assert/strict";

import {
  buildProfileSearchQuery,
  type RankingProfile,
} from "../lib/job-ranking";
import { buildProfileEmbeddingText } from "../lib/embeddings/cache";
import { toRichRankingProfile } from "../lib/intake/shared/toRankingProfile";
import type { UserProfile } from "../lib/profile";

const resumeOnlyProfile = {
  name: "Rhea Systems",
  email: "rhea@example.com",
  links: {},
  resume: {
    filename: "rhea.pdf",
    uploadedAt: "2026-04-26T00:00:00.000Z",
    rawText:
      "Senior backend engineer building Rust services, GraphQL APIs, Postgres storage, and distributed schedulers.",
  },
  experience: [],
  education: [],
  skills: [],
  prefs: { roles: [], locations: ["Remote"] },
  suggestions: [],
  provenance: { resume: "resume" },
  log: [],
  updatedAt: "2026-04-26T00:00:00.000Z",
} satisfies UserProfile;

const richResumeProfile = toRichRankingProfile(resumeOnlyProfile);
assert.match(
  buildProfileSearchQuery(richResumeProfile),
  /Rust services/,
  "BM25 query must include resume raw text when resume is the primary source"
);
assert.match(
  buildProfileEmbeddingText(richResumeProfile),
  /GraphQL APIs/,
  "embedding query must include resume raw text when resume is the primary source"
);

const assembledProfile = {
  ...resumeOnlyProfile,
  resume: undefined,
  experience: [
    {
      company: "Vector Labs",
      title: "Platform Engineer",
      description: "",
      roleSummary: "Owned event-driven platform services.",
      keyResponsibilities: ["Built Kafka consumers"],
      technologiesMentioned: ["Kafka", "Go"],
    },
  ],
  github: {
    username: "rhea",
    topRepos: [
      {
        name: "scheduler",
        url: "https://github.com/rhea/scheduler",
        description: "",
        language: "TypeScript",
        whatItDoes: "Distributed scheduler for background jobs.",
        keyTechnologies: ["Temporal", "Postgres"],
      },
    ],
  },
} as unknown as UserProfile;

const richAssembled = toRichRankingProfile(assembledProfile);
assert.match(
  buildProfileSearchQuery(richAssembled),
  /event-driven platform services/,
  "ranking query must include LinkedIn/experience summary enrichment"
);
assert.match(
  buildProfileEmbeddingText(richAssembled),
  /Temporal/,
  "ranking embedding text must include GitHub repo summary enrichment"
);

const rankingProfile: RankingProfile = richAssembled;
assert.ok(rankingProfile.repoHighlights?.[0]?.summary.includes("Distributed scheduler"));

console.log("job ranking profile input tests passed");
