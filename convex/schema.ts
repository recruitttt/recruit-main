import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const isoString = v.string();
const legacyTable = () => defineTable(v.any());

export default defineSchema({
  // Preserve indexes that already exist in the shared dev deployment. These
  // tables are not part of the Ashby v1 path, so keep them schemaless here.
  alerts: legacyTable().index("by_created", ["created_at"]),
  audit_events: legacyTable().index("by_user_created", [
    "user_id",
    "created_at",
  ]),
  batch_jobs: legacyTable()
    .index("by_provider_batch", ["provider_batch_id"])
    .index("by_status", ["status"]),
  batch_results: legacyTable().index("by_outbox", ["outbox_id"]),
  consent_preferences: legacyTable().index("by_user_domain", [
    "user_id",
    "domain",
  ]),
  dlq_items: legacyTable().index("by_user", ["user_id"]),
  essay_jobs: legacyTable().index("by_user", ["user_id"]),
  llm_outbox: legacyTable()
    .index("by_batch_ref", ["batch_ref"])
    .index("by_dedup_key", ["template", "dedup_key"])
    .index("by_status_urgency", ["status", "urgency"]),
  processed_stripe_events: legacyTable().index("by_event_id", ["event_id"]),
  queue_applications: legacyTable().index("by_user_status", [
    "user_id",
    "status",
  ]),
  ranking_jobs: legacyTable().index("by_user", ["user_id"]),
  subscriptions: legacyTable().index("by_user", ["user_id"]),
  tailoring_jobs: legacyTable().index("by_user", ["user_id"]),
  users: legacyTable().index("by_clerk_id", ["clerk_id"]),

  demoProfiles: defineTable({
    demoUserId: v.string(),
    profile: v.any(),
    updatedAt: isoString,
  }).index("by_demo_user", ["demoUserId"]),

  ashbySources: defineTable({
    company: v.string(),
    slug: v.string(),
    careersUrl: v.string(),
    enabled: v.boolean(),
    notes: v.optional(v.string()),
    seededFrom: v.string(),
    updatedAt: isoString,
  })
    .index("by_slug", ["slug"])
    .index("by_enabled", ["enabled"]),

  atsSources: defineTable({
    provider: v.union(
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("workday"),
      v.literal("workable")
    ),
    company: v.string(),
    slug: v.string(),
    careersUrl: v.optional(v.string()),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    seededFrom: v.optional(v.string()),
    updatedAt: isoString,
  })
    .index("by_provider_slug", ["provider", "slug"])
    .index("by_provider_enabled", ["provider", "enabled"])
    .index("by_enabled", ["enabled"]),

  ingestionRuns: defineTable({
    demoUserId: v.string(),
    status: v.union(
      v.literal("fetching"),
      v.literal("fetched"),
      v.literal("ranking"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: isoString,
    completedAt: v.optional(isoString),
    sourceCount: v.number(),
    fetchedCount: v.number(),
    rawJobCount: v.number(),
    filteredCount: v.number(),
    survivorCount: v.number(),
    llmScoredCount: v.number(),
    recommendedCount: v.number(),
    errorCount: v.number(),
    errors: v.array(
      v.object({
        source: v.string(),
        message: v.string(),
      })
    ),
    model: v.optional(v.string()),
    scoringMode: v.optional(v.string()),
  })
    .index("by_demo_user_started", ["demoUserId", "startedAt"])
    .index("by_status", ["status"]),

  ingestedJobs: defineTable({
    runId: v.id("ingestionRuns"),
    sourceId: v.optional(v.id("ashbySources")),
    demoUserId: v.string(),
    company: v.string(),
    sourceSlug: v.string(),
    title: v.string(),
    normalizedTitle: v.string(),
    location: v.optional(v.string()),
    isRemote: v.optional(v.boolean()),
    workplaceType: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    department: v.optional(v.string()),
    team: v.optional(v.string()),
    descriptionPlain: v.optional(v.string()),
    compensationSummary: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    currency: v.optional(v.string()),
    jobUrl: v.string(),
    applyUrl: v.optional(v.string()),
    publishedAt: v.optional(isoString),
    dedupeKey: v.string(),
    raw: v.any(),
    createdAt: isoString,
  })
    .index("by_run", ["runId"])
    .index("by_job_url", ["jobUrl"])
    .index("by_dedupe", ["dedupeKey"]),

  jobFilterDecisions: defineTable({
    runId: v.id("ingestionRuns"),
    jobId: v.id("ingestedJobs"),
    status: v.union(v.literal("kept"), v.literal("rejected")),
    reasons: v.array(v.string()),
    ruleScore: v.number(),
    createdAt: isoString,
  })
    .index("by_run", ["runId"])
    .index("by_job", ["jobId"]),

  jobScores: defineTable({
    runId: v.id("ingestionRuns"),
    jobId: v.id("ingestedJobs"),
    bm25Score: v.number(),
    bm25Normalized: v.number(),
    ruleScore: v.number(),
    llmScore: v.optional(v.number()),
    totalScore: v.number(),
    scoringMode: v.string(),
    rationale: v.optional(v.string()),
    strengths: v.array(v.string()),
    risks: v.array(v.string()),
    createdAt: isoString,
  })
    .index("by_run", ["runId"])
    .index("by_job", ["jobId"]),

  jobRecommendations: defineTable({
    demoUserId: v.string(),
    runId: v.id("ingestionRuns"),
    jobId: v.id("ingestedJobs"),
    rank: v.number(),
    score: v.number(),
    llmScore: v.optional(v.number()),
    company: v.string(),
    title: v.string(),
    location: v.optional(v.string()),
    jobUrl: v.string(),
    compensationSummary: v.optional(v.string()),
    rationale: v.optional(v.string()),
    strengths: v.array(v.string()),
    risks: v.array(v.string()),
    createdAt: isoString,
  })
    .index("by_demo_user", ["demoUserId"])
    .index("by_run", ["runId"]),

  tailoredApplications: defineTable({
    demoUserId: v.string(),
    jobId: v.id("ingestedJobs"),
    runId: v.optional(v.id("ingestionRuns")),
    status: v.union(
      v.literal("tailoring"),
      v.literal("completed"),
      v.literal("failed")
    ),
    job: v.any(),
    research: v.optional(v.any()),
    tailoredResume: v.optional(v.any()),
    tailoringScore: v.optional(v.number()),
    keywordCoverage: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    pdfReady: v.boolean(),
    pdfFilename: v.optional(v.string()),
    pdfByteLength: v.optional(v.number()),
    pdfBase64: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: isoString,
    updatedAt: isoString,
  })
    .index("by_demo_user", ["demoUserId"])
    .index("by_job", ["jobId"])
    .index("by_run", ["runId"]),

  applications: defineTable({
    demoUserId: v.string(),
    jobId: v.optional(v.id("ingestedJobs")),
    company: v.string(),
    title: v.string(),
    provider: v.string(),
    jobUrl: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("ready_to_apply"),
      v.literal("applied"),
      v.literal("follow_up_due"),
      v.literal("followed_up"),
      v.literal("responded"),
      v.literal("interview"),
      v.literal("rejected"),
      v.literal("offer"),
      v.literal("closed"),
      v.literal("blocked")
    ),
    appliedAt: v.optional(isoString),
    lastStatusAt: isoString,
    nextFollowUpAt: v.optional(isoString),
    responseAt: v.optional(isoString),
    responseSummary: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: isoString,
    updatedAt: isoString,
  })
    .index("by_demo_user_status", ["demoUserId", "status"])
    .index("by_demo_user_updated", ["demoUserId", "updatedAt"])
    .index("by_job", ["jobId"])
    .index("by_next_follow_up", ["demoUserId", "nextFollowUpAt"]),

  followUpTasks: defineTable({
    demoUserId: v.string(),
    applicationId: v.id("applications"),
    channel: v.union(
      v.literal("email"),
      v.literal("linkedin"),
      v.literal("manual")
    ),
    state: v.union(
      v.literal("scheduled"),
      v.literal("draft_ready"),
      v.literal("sent_manually"),
      v.literal("skipped"),
      v.literal("blocked")
    ),
    scheduledFor: isoString,
    completedAt: v.optional(isoString),
    draftId: v.optional(v.id("outreachDrafts")),
    sequence: v.optional(v.number()),
    createdAt: isoString,
    updatedAt: isoString,
  })
    .index("by_application", ["applicationId"])
    .index("by_demo_user_state_scheduled", [
      "demoUserId",
      "state",
      "scheduledFor",
    ]),

  outreachDrafts: defineTable({
    demoUserId: v.string(),
    applicationId: v.id("applications"),
    taskId: v.optional(v.id("followUpTasks")),
    channel: v.union(
      v.literal("email"),
      v.literal("linkedin"),
      v.literal("manual")
    ),
    subject: v.optional(v.string()),
    body: v.string(),
    recipient: v.optional(v.string()),
    tone: v.optional(v.string()),
    source: v.string(),
    approvedAt: v.optional(isoString),
    createdAt: isoString,
    updatedAt: isoString,
  })
    .index("by_application", ["applicationId"])
    .index("by_task", ["taskId"]),

  jobPipelineArtifacts: defineTable({
    demoUserId: v.string(),
    runId: v.optional(v.id("ingestionRuns")),
    jobId: v.id("ingestedJobs"),
    kind: v.union(
      v.literal("ingested_description"),
      v.literal("ranking_score"),
      v.literal("research_snapshot"),
      v.literal("tailored_resume"),
      v.literal("cover_letter"),
      v.literal("pdf_ready"),
      v.literal("pdf_file")
    ),
    title: v.string(),
    content: v.optional(v.string()),
    payload: v.optional(v.any()),
    createdAt: isoString,
  })
    .index("by_job", ["jobId"])
    .index("by_run", ["runId"])
    .index("by_demo_user", ["demoUserId"]),

  pipelineLogs: defineTable({
    demoUserId: v.string(),
    runId: v.optional(v.id("ingestionRuns")),
    stage: v.string(),
    level: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    payload: v.optional(v.any()),
    createdAt: isoString,
  })
    .index("by_run", ["runId", "createdAt"])
    .index("by_demo_user", ["demoUserId", "createdAt"]),

  // ---------------------------------------------------------------------------
  // Intake tables (gh-applicant merge — see specs/2026-04-25-recruit-merge-design.md §4)
  // All keyed by userId (better-auth user id).
  // ---------------------------------------------------------------------------

  // Canonical UserProfile blob (lib/profile.ts shape) plus provenance + log.
  userProfiles: defineTable({
    userId: v.string(),
    profile: v.any(),
    provenance: v.record(v.string(), v.string()),
    log: v.array(v.any()),
    updatedAt: isoString,
  }).index("by_user", ["userId"]),

  // Latest raw GitHub snapshot (RawGithubSnapshot — excludes per-repo source files).
  githubSnapshots: defineTable({
    userId: v.string(),
    fetchedAt: isoString,
    raw: v.any(),
  }).index("by_user", ["userId"]),

  // Bulk pre-fetched repo source files (sharded out to avoid 1MB doc limit).
  repoSourceFiles: defineTable({
    userId: v.string(),
    repoFullName: v.string(),
    files: v.array(v.any()),
    fetchedAt: isoString,
  }).index("by_user_repo", ["userId", "repoFullName"]),

  // Per-repo Haiku summaries with content-hash cache invalidation.
  repoSummaries: defineTable({
    userId: v.string(),
    repoFullName: v.string(),
    sourceContentHash: v.string(),
    summary: v.any(),
    generatedByModel: v.string(),
    generatedAt: isoString,
  }).index("by_user_repo", ["userId", "repoFullName"]),

  // Latest LinkedIn snapshot (raw scrape result + main profile URL).
  linkedinSnapshots: defineTable({
    userId: v.string(),
    fetchedAt: isoString,
    profileUrl: v.string(),
    raw: v.any(),
  }).index("by_user", ["userId"]),

  // LinkedIn auth cookies for re-runs (see TODO in convex/linkedinCookies.ts re: encryption).
  linkedinCookies: defineTable({
    userId: v.string(),
    liAt: v.string(),
    jsessionId: v.optional(v.string()),
    capturedAt: isoString,
    expiresAt: v.optional(isoString),
  }).index("by_user", ["userId"]),

  // Per-experience Haiku summaries (LinkedIn experience entries).
  experienceSummaries: defineTable({
    userId: v.string(),
    experienceKey: v.string(),
    sourceContentHash: v.string(),
    summary: v.any(),
    generatedByModel: v.string(),
    generatedAt: isoString,
  }).index("by_user_exp", ["userId", "experienceKey"]),

  // Sonnet consolidated AI report (one per user, replaces on regeneration).
  aiReports: defineTable({
    userId: v.string(),
    report: v.any(),
    generatedByModel: v.string(),
    generatedAt: isoString,
  }).index("by_user", ["userId"]),

  // Live progress stream for every adapter run (UI subscribes for real-time events).
  intakeRuns: defineTable({
    userId: v.string(),
    kind: v.union(
      v.literal("github"),
      v.literal("linkedin"),
      v.literal("resume"),
      v.literal("web"),
      v.literal("chat"),
      v.literal("ai-report")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    events: v.array(v.any()),
    startedAt: isoString,
    completedAt: v.optional(isoString),
    error: v.optional(v.string()),
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_status", ["userId", "status"]),
});
