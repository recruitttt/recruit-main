# Recruit-merge: gh-applicant → recruit-main

**Date:** 2026-04-25
**Status:** Approved (locked picks across 10 axes)
**Implementation strategy:** Big-bang single ship, heavily parallelized via subagents

---

## 1. Overview

Merge the gh-applicant prototype (deep GitHub OAuth + bulk source-code analysis + Browserbase LinkedIn scraper + Haiku/Sonnet AI summarization) into recruit-main (the actual product: Next.js 16 + Convex + better-auth, autonomous job-application agent). After the merge, gh-applicant is deleted. recruit-main becomes the single product with vastly richer user-profile intake.

**Terminology:** recruit-main already uses "ingestion" for **job-board** ingestion (Ashby/Greenhouse/Lever/Workable — pulling jobs into the system). User-data collection is called **"intake"** to disambiguate. recruit-main already has `app/api/intake/`.

## 2. Goals & non-goals

**Goals**
- Centralize all data in Convex (multi-user, queryable, real-time)
- Replace shallow `lib/scrapers` (OpenAI-web GitHub, Proxycurl LinkedIn) with deep gh-applicant pipelines
- Auto-trigger background intake the moment the user signs in via GitHub
- Stream live progress for every adapter so the UI can show "still pulling X" badges
- Profile display page in two synchronized views: dense data dashboard + interactive knowledge graph
- One-shot big-bang merge using parallel subagents

**Non-goals**
- 3D onboarding visual (untouched per Q7)
- Job-board ingestion subsystem (Ashby/Greenhouse — untouched)
- Unit tests (per Q9 — explicit user instruction)
- Private GitHub repos (`repo` scope upgrade is v2)
- Migrating recruit-main's existing `dashboard`, `applications`, `dlq`, `pricing`, `settings` routes (left intact)

## 3. Architecture

```
recruit-main/
├── app/
│   ├── (app)/
│   │   ├── dashboard/       # untouched
│   │   ├── applications/    # untouched
│   │   ├── dlq/             # untouched
│   │   ├── settings/        # untouched
│   │   └── profile/         # NEW — dense + graph view (this spec)
│   ├── onboarding/          # MODIFIED — step 3 rewritten
│   ├── sign-in/             # MODIFIED — adds GitHub OAuth button
│   ├── sign-up/             # untouched
│   └── api/
│       ├── auth/            # MODIFIED — better-auth + GitHub provider
│       ├── intake/          # MODIFIED — adapter dispatcher
│       └── ...              # rest untouched
├── lib/
│   ├── ingestion/           # untouched (job-board ingestion)
│   ├── scrapers/            # DEPRECATED (kept as fallback only)
│   └── intake/              # NEW
│       ├── shared/          # types, mapper, runIntake helper
│       ├── github/          # extractor + ai-summarizer + per-repo
│       ├── linkedin/        # Browserbase Node SDK port + SDUI parsers
│       ├── resume/          # adapter wrapping existing /api/parse/resume
│       ├── web/             # adapter wrapping OpenAI-web for DevPost/sites
│       └── chat/            # chatbot Q&A → profile patches
├── convex/
│   ├── schema.ts            # MODIFIED — new tables added
│   ├── userProfiles.ts      # NEW — canonical profile mutations/queries
│   ├── githubSnapshots.ts   # NEW
│   ├── repoSourceFiles.ts   # NEW (bulk pre-fetched source cache)
│   ├── repoSummaries.ts     # NEW
│   ├── linkedinSnapshots.ts # NEW
│   ├── linkedinCookies.ts   # NEW (encrypted cookie persistence)
│   ├── experienceSummaries.ts # NEW
│   ├── aiReports.ts         # NEW
│   ├── intakeRuns.ts        # NEW (live progress stream)
│   └── intakeActions.ts     # NEW (long-running adapter dispatchers)
└── components/
    └── profile/             # NEW — DataView, GraphView, ProvenancePill
```

After the merge:
```bash
rm -rf /Users/omsanan/Downloads/github   # the standalone gh-applicant repo
```

## 4. Data model (Convex schema additions)

```ts
// convex/schema.ts (added to existing schema)

userProfiles: defineTable({
  userId: v.string(),                // FK to better-auth users
  profile: v.any(),                  // UserProfile blob (lib/profile.ts shape)
  provenance: v.record(v.string(), v.string()),  // field path → source
  log: v.array(v.any()),             // ProfileLogEntry[]
  updatedAt: isoString,
}).index("by_user", ["userId"]),

githubSnapshots: defineTable({
  userId: v.string(),
  fetchedAt: isoString,
  raw: v.any(),                      // RawGithubSnapshot (excluding repoSourceFiles)
}).index("by_user", ["userId"]),

repoSourceFiles: defineTable({       // sharded out — large blob per repo
  userId: v.string(),
  repoFullName: v.string(),
  files: v.array(v.any()),           // FetchedSourceFile[] (40 files / 250 KB)
  fetchedAt: isoString,
}).index("by_user_repo", ["userId", "repoFullName"]),

repoSummaries: defineTable({
  userId: v.string(),
  repoFullName: v.string(),
  sourceContentHash: v.string(),     // for cache invalidation
  summary: v.any(),                  // RepoSummary fields
  generatedByModel: v.string(),
  generatedAt: isoString,
}).index("by_user_repo", ["userId", "repoFullName"]),

linkedinSnapshots: defineTable({
  userId: v.string(),
  fetchedAt: isoString,
  profileUrl: v.string(),
  raw: v.any(),                      // LinkedInSnapshot
}).index("by_user", ["userId"]),

linkedinCookies: defineTable({
  userId: v.string(),
  liAt: v.string(),                  // encrypted via Convex env-bound key
  jsessionId: v.optional(v.string()),
  capturedAt: isoString,
  expiresAt: v.optional(isoString),
}).index("by_user", ["userId"]),

experienceSummaries: defineTable({
  userId: v.string(),
  experienceKey: v.string(),         // company::position::fromDate
  sourceContentHash: v.string(),
  summary: v.any(),
  generatedByModel: v.string(),
  generatedAt: isoString,
}).index("by_user_exp", ["userId", "experienceKey"]),

aiReports: defineTable({
  userId: v.string(),
  report: v.any(),                   // ConsolidatedReport
  generatedByModel: v.string(),
  generatedAt: isoString,
}).index("by_user", ["userId"]),

intakeRuns: defineTable({
  userId: v.string(),
  kind: v.union(
    v.literal("github"), v.literal("linkedin"), v.literal("resume"),
    v.literal("web"), v.literal("chat"), v.literal("ai-report")
  ),
  status: v.union(
    v.literal("queued"), v.literal("running"),
    v.literal("completed"), v.literal("failed")
  ),
  events: v.array(v.any()),          // IntakeProgressEvent[]
  startedAt: isoString,
  completedAt: v.optional(isoString),
  error: v.optional(v.string()),
}).index("by_user_kind", ["userId", "kind"])
  .index("by_user_status", ["userId", "status"]),
```

Resume PDFs go to Convex `_storage`. The `userProfiles.profile` field is the **canonical** profile; everything else is source-of-truth for re-deriving it.

## 5. Auth flow

**better-auth + GitHub OAuth provider**:
```ts
// lib/auth-server.ts
import { github } from "better-auth/social-providers";
authServer = convexBetterAuthNextJs({
  convexUrl, convexSiteUrl,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      scope: ["read:user", "user:email", "read:org"],
      mapProfileToUser: (profile) => ({ name: profile.name, email: profile.email, image: profile.avatar_url }),
    },
  },
  account: { accountLinking: { enabled: true, trustedProviders: ["github"] } },
});
```

**OAuth callback hook** (better-auth `events.signIn.after`):
1. Persist `account.accessToken` (better-auth handles this) — readable via `convex.query("auth.githubToken", { userId })`.
2. If `intakeRuns.byUser(userId, "github")` is empty → schedule `intakeActions.runGithubIntake(userId)` with `ctx.scheduler.runAfter(0, ...)`.
3. Redirect to `/onboarding` (continuing flow) or `/dashboard` (returning user).

**Email-signup users**: dashboard shows "Connect GitHub" button → standard OAuth flow → same auto-trigger fires after callback.

## 6. Intake adapter contract

```ts
// lib/intake/shared/types.ts
export type ProvenanceSource = "chat" | "resume" | "github" | "linkedin" | "website" | "devpost" | "manual";

export interface IntakeProgressEvent {
  stage: string;                                  // "starting" | "scrape" | "summarize" | etc
  message?: string;
  done?: number; total?: number;                  // for progress bars
  patch?: Partial<UserProfile>;                   // when set, gets merged into userProfiles
  provenance?: Record<string, ProvenanceSource>; // field-path → source
  level?: "info" | "warn" | "error";
}

export interface IntakeContext {
  userId: string;
  ctx: ActionCtx;                  // Convex action context (for db, scheduler, _storage)
  credentials: AICredentials;
  now: () => string;
}

export interface IntakeAdapter<TInput> {
  name: "github" | "linkedin" | "resume" | "web" | "chat";
  run(input: TInput, ctx: IntakeContext): AsyncIterable<IntakeProgressEvent>;
}
```

Driver in `lib/intake/shared/runIntake.ts`:
```ts
export async function runIntake<I>(
  adapter: IntakeAdapter<I>, input: I, ctx: IntakeContext
): Promise<void> {
  const runId = await ctx.ctx.runMutation(api.intakeRuns.start, { userId: ctx.userId, kind: adapter.name });
  try {
    for await (const event of adapter.run(input, ctx)) {
      await ctx.ctx.runMutation(api.intakeRuns.appendEvent, { runId, event });
      if (event.patch || event.provenance) {
        await ctx.ctx.runMutation(api.userProfiles.merge, {
          userId: ctx.userId, patch: event.patch ?? {}, provenance: event.provenance ?? {},
        });
      }
    }
    await ctx.ctx.runMutation(api.intakeRuns.complete, { runId });
  } catch (e) {
    await ctx.ctx.runMutation(api.intakeRuns.fail, { runId, error: String(e) });
    throw e;
  }
}
```

UI live-streams via `useQuery(api.intakeRuns.byUserKind, { userId, kind })` — Convex push-updates the events array.

## 7. Adapter implementations

### 7.1 GitHub (`lib/intake/github/`)
- Direct port of `packages/extractor` + `packages/ai-summarizer/per-repo` + `packages/mapper/projects+skills+links`.
- Uses Octokit REST + GraphQL; bulk source-file pre-fetch via `git/trees?recursive=1` + parallel `git/getBlob` (40 files / 250 KB / repo with RepoGPT-derived ignore list).
- Per-repo Haiku summarization with code-grounded `whatItDoes` (4-6 sentences, ≥400 chars), `metadataSummary` subfield, `sourceContentHash` cache.
- Adapter input: `{ token: string }` (from better-auth `accounts` row).
- Stages: `starting` → `user` → `repos` → `enrich-repos` (per-repo bulk fetch) → `summarize-repos` (Haiku per repo) → `mapper` (snapshot → UserProfile patch) → `complete`.

### 7.2 LinkedIn (`lib/intake/linkedin/`) — Python killed, Browserbase Node SDK port
- Replace Selenium Python with **Browserbase Node SDK** (Playwright-based, single language, deployable on Vercel).
- Auth resolution order:
  1. Saved cookie from `linkedinCookies` table → verify against `/feed/` → if accepted, use it
  2. Email + password from env → fill login form → handle email-PIN challenge via `intakeRuns` event the user can respond to from the dashboard (writes the PIN back through a Convex mutation)
  3. Live-view URL fallback (Browserbase `sessions.debug.list()`) — emit URL as a `level: "warn"` event so UI surfaces it
- After successful auth: persist `li_at` (encrypted) to `linkedinCookies` table for re-runs
- Scrape main + 8 detail subpages
- **SDUI parsers**: port `scripts/linkedin-scrape.py`'s `_sdui_parse_section`, `parse_skills`, `parse_publications`, `parse_honors`, `parse_interests` from Python regex → TS regex (1:1 — pure functions, no driver coupling)
- Per-experience Haiku summarization (`packages/ai-summarizer/per-experience` ported)
- Mapper produces `Partial<UserProfile>` with `linkedin` provenance
- Browserbase session uses `keep_alive=True` + 30-min `api_timeout` so re-runs don't burn captchas

### 7.3 Resume (`lib/intake/resume/`)
- Wraps existing `/api/parse/resume` (PDF text extract + LLM structured extract) in adapter contract.
- Input: `{ fileId: Id<"_storage"> }` — file already uploaded to Convex storage by the onboarding form.
- Stages: `starting` → `parse-pdf` → `llm-extract` → `complete`.

### 7.4 Web (`lib/intake/web/`)
- Wraps existing OpenAI-web + Firecrawl scrapers.
- Input: `{ url: string, kind: "devpost" | "website" }`.
- Stages: `starting` → `scrape` → `llm-extract` → `complete`.

### 7.5 Chat (`lib/intake/chat/`)
- New adapter for chatbot-collected fields. Existing recruit-main chat code already writes to localStorage — we add a server-side adapter that ALSO writes patches to Convex via `runIntake`.
- Input: `{ messages: ChatMessage[], extractTargets: ProfileFieldPath[] }`.
- Stages: `starting` → `extract-fields` (LLM extracts requested targets from chat history) → `complete`.

## 8. Onboarding flow rewrite

Step structure stays at 5; behavior changes:

| Step | Name | Behavior |
|---|---|---|
| 1 | Account | GitHub OAuth button + email signup. **GitHub sign-in immediately fires `runIntake("github")` in the background** before the user advances. By step 2, repos are already pulling. |
| 2 | Resume | File upload → uploads to Convex `_storage` → fires `runIntake("resume")`. Fast (~5s). User sees parsed name/email/skills appear in the live profile card. |
| 3 | Connect | Shown ONLY if user signed in via email (skipped for GitHub-signed-in users since GitHub is already running). Form collects LinkedIn URL + optional DevPost/website + "Connect GitHub" button. **Each field paste fires its adapter immediately**; UI shows live progress badges per source. User can advance without waiting. |
| 4 | Preferences | Roles/locations/work auth (synchronous local form). |
| 5 | Activate | Dashboard intro. Heavy AI summarization (Haiku per-repo + Sonnet consolidator) runs as `runIntake("ai-report")`. Progress streams to dashboard. |

3D onboarding visual layer untouched.

## 9. Profile display page (`/profile`)

Dual-mode toggle in the page header: **Data view** | **Graph view**. Both backed by the same `useQuery(api.userProfiles.byUser, { userId })`.

### 9.1 Data view (Q6 option A)
Sectioned dense dashboard:
- **Header card**: avatar, name, headline, location, last-synced timestamps per source, `ProvenanceLegend`
- **Sections** (each with a `<details>` "raw data" drawer):
  1. Identity & contact
  2. Experience timeline (LinkedIn primary; augmented by GitHub commit timeline)
  3. Education
  4. Projects (GitHub repos with code-grounded `whatItDoes` summaries)
  5. Skills (merged from GitHub languages/frameworks/manifests + LinkedIn skills + chat)
  6. Publications, honors, certifications, languages, interests
- **Provenance pills** on every field: `from github` / `from linkedin` / `from chat` / `from resume` / `from manual`
- Hover any field → tooltip shows full provenance chain

### 9.2 Graph view (Q6 option D)
Interactive force-directed graph using `react-force-graph-2d`:
- **Node types**: Person (you, central), Project, Company, School, Skill, Publication, Honor
- **Edges**: `built` (Person→Project), `worked_at` (Person→Company), `studied_at` (Person→School), `uses_skill` (Project→Skill), `wrote` (Person→Publication), `received` (Person→Honor)
- **Interactions**:
  - Click node → side drawer with full data + edit
  - Filter pills: "AI work only", "Research only", "2025+ only", etc
  - Hover edge → tooltip with relationship details
- Both views derive their data from the canonical `userProfiles.profile` doc — no duplicate state, real-time updates via Convex subscriptions.

## 10. Background runner

- **Convex actions** for long-running jobs (`ctx.scheduler.runAfter(0, ...)` for fire-and-forget).
- Each adapter run writes events into `intakeRuns` row (`status`, `events[]`, `lastEventAt`).
- **Convex query** `intakeRuns.live(userId)` returns most recent N events; UI subscribes for real-time updates without polling.
- On adapter completion, the `runIntake` driver merges patches into `userProfiles` atomically.
- **Failures don't block other adapters**; per-adapter error surfaces in the `intakeRuns` row.
- **Convex action time limit (~10 min default)**: heavy intake breaks into chunked actions (per-repo summarization runs N=5 in parallel, each call <60s).
- **Resume after disconnect**: Browserbase `keep_alive` sessions persist; if a Convex action times out, the next invocation can reattach via `BROWSERBASE_SESSION_ID`.

## 11. Implementation phases & subagent orchestration guide

Per Q9: big-bang single ship, parallelize via subagents, no unit tests.

### 11.1 Phase plan

| Phase | Type | Owner | Description |
|---|---|---|---|
| 0 | Sequential | Main | Clone recruit-main, copy gh-applicant pieces flat, install deps |
| 1 | Sequential | Subagent A | Convex schema + storage helpers (foundation) |
| 2 | Parallel × 7 | Subagents B–H | Auth, GitHub, LinkedIn, Resume/Web/Chat, Profile DataView, Profile GraphView, Onboarding rewrite |
| 3 | Parallel × N | Reviewer subagents | Per-module reviewers in parallel |
| 4 | Sequential | Main | Wire everything, run dev server, smoke-test, fix integration breakages |
| 5 | Parallel × 3 | Reviewer subagents | E2E flow runner + dead-code sweep + doc updater |

### 11.2 Subagent orchestration guide

The user explicitly said "the more the merrier" — push subagent usage hard. Patterns to apply:

#### A. **Parallel work pattern** — dispatch many subagents in ONE message
When subagent tasks are independent (different files, no shared state), dispatch them all in a single message with multiple `Agent` tool calls. They run truly in parallel.

```ts
// One assistant message containing:
Agent({ description: "GitHub adapter port", subagent_type: "general-purpose", prompt: "..." })
Agent({ description: "LinkedIn Browserbase port", subagent_type: "general-purpose", prompt: "..." })
Agent({ description: "Resume adapter wrapper", subagent_type: "general-purpose", prompt: "..." })
Agent({ description: "Profile DataView page", subagent_type: "general-purpose", prompt: "..." })
Agent({ description: "Profile GraphView page", subagent_type: "general-purpose", prompt: "..." })
Agent({ description: "Auth + GitHub provider", subagent_type: "general-purpose", prompt: "..." })
```
7 simultaneous workers + 1 main loop = ~7× wall-clock speedup on the parallelizable phase.

#### B. **Context offload pattern** — push exploratory work to subagents
Before implementing, dispatch a subagent to read 20+ files and produce a synthesis. The subagent burns context exploring; main loop receives a 200-token summary.

> "Read all of `recruit-main/lib/scrapers/*` + `lib/onboarding-storage.ts` + `lib/profile.ts` + `convex/schema.ts`. Produce a 6-bullet summary of: (1) what data shape `UserProfile` has, (2) what scrapers exist, (3) what Convex tables already exist, (4) where onboarding writes profile data, (5) any naming collisions with our planned `lib/intake/*`, (6) anything else that affects the merge."

This keeps main context lean for the actual implementation work.

#### C. **Reviewer subagent pattern** — spawn reviewers AFTER each implementation subagent
For every implementation subagent, spawn a paired reviewer in the next message round. Reviewers check:
- Does the code typecheck?
- Are there obvious bugs?
- Is the contract honored (e.g., does the adapter actually emit `IntakeProgressEvent`)?
- Are there auth/security issues?
- Are file paths/imports correct?

```ts
Agent({ description: "Review GitHub adapter port", subagent_type: "code-reviewer",
       prompt: "Review the diff at <files>. Check: emits IntakeProgressEvent contract; uses Octokit correctly; handles 401/rate-limits; persists to Convex tables not Drizzle; no leftover gh-applicant import paths. Report HIGH/MED/LOW issues only." })
```
Run reviewers in parallel with the next phase's implementation subagents.

#### D. **Validator subagent pattern** — automated checks
After each phase, dispatch a subagent that runs `pnpm typecheck`, hits the dev server with curl, inspects Convex dashboard, etc. Report pass/fail in 50 tokens.

> "Run `pnpm typecheck --force` from the repo root. Report only the package names and pass/fail. If any fail, paste the first 20 lines of error output. Then curl http://localhost:3001/api/intake/status and report the status code."

#### E. **Pipeline pattern** — sequential subagents with sync points
Phase 1 (schema) MUST finish before Phase 2 (adapters that import from schema). Dispatch sequentially with a sync point. Within Phase 2, all subagents run parallel.

#### F. **Specialist routing**
Route to the most specialized subagent type available:
- `general-purpose` for implementation
- `code-reviewer` for review passes
- `architect` for design questions during implementation
- `database-reviewer` for Convex schema review
- `e2e-runner` for smoke-testing the full flow at the end
- `refactor-cleaner` for the final dead-code sweep (delete `lib/scrapers/` after the new adapters land)
- `doc-updater` for README + CLAUDE.md updates after the merge

#### G. **Background subagents** for long-running tasks
For subagents that take >2 min, set `run_in_background: true` and continue dispatching others. Get a notification when they finish.

```ts
Agent({ description: "Smoke test full onboarding flow",
       subagent_type: "e2e-runner",
       run_in_background: true,
       prompt: "Walk through the full onboarding flow at http://localhost:3001. Sign in with GitHub, complete steps 2-5, verify intakeRuns events appear. Report pass/fail with screenshots." })
// Continue dispatching other subagents in the same message ↓
```

#### H. **Self-pruning subagent prompts**
Every subagent prompt should:
- State the goal in 1 sentence
- List the EXACT files to read first (absolute paths)
- List the EXACT files to modify (absolute paths)
- State constraints (no any, Zod, AI SDK v6, no new deps)
- Demand a typecheck pass at the end
- Demand a 5-7 sentence summary at the end

This keeps the subagent's context tight and its return value useful for synthesis.

#### I. **Subagent matrix for this merge**

| Phase | Subagent | Type | Background? | Files |
|---|---|---|---|---|
| 0 | Setup (main) | — | no | repo skeleton |
| 1 | Schema + helpers | `general-purpose` | no | `convex/schema.ts`, `convex/userProfiles.ts`, `lib/intake/shared/types.ts` |
| 2 | Auth + GitHub provider | `general-purpose` | no | `lib/auth-server.ts`, `app/sign-in/`, `convex/auth.ts` |
| 2 | GitHub adapter | `general-purpose` | yes | `lib/intake/github/**` |
| 2 | LinkedIn adapter | `general-purpose` | yes | `lib/intake/linkedin/**` (incl. SDUI parser ports) |
| 2 | Resume + Web + Chat | `general-purpose` | no | `lib/intake/{resume,web,chat}/**` |
| 2 | Profile DataView | `general-purpose` | no | `app/(app)/profile/page.tsx`, `components/profile/DataView.tsx` |
| 2 | Profile GraphView | `general-purpose` | no | `components/profile/GraphView.tsx` |
| 2 | Onboarding rewrite | `general-purpose` | no | `app/onboarding/page.tsx` |
| 3 | Schema review | `database-reviewer` | yes | Convex schema diff |
| 3 | GitHub review | `code-reviewer` | yes | `lib/intake/github/**` diff |
| 3 | LinkedIn review | `code-reviewer` | yes | `lib/intake/linkedin/**` diff |
| 3 | Auth security review | `security-reviewer` | yes | auth files diff |
| 4 | Integration (main) | — | no | wiring, smoke test |
| 5 | E2E flow | `e2e-runner` | yes | full onboarding walkthrough |
| 5 | Dead-code sweep | `refactor-cleaner` | no | `lib/scrapers/` deletion |
| 5 | Doc update | `doc-updater` | no | README, CLAUDE.md |

That's **~15 subagent dispatches** across the merge. Phases 2-3 fan out to 8 parallel workers.

### 11.3 Wall-clock estimate
- Phase 0: 10 min (sequential, main)
- Phase 1: 15 min (one subagent)
- Phase 2: 30-45 min (7 parallel subagents — slowest determines)
- Phase 3: 10-15 min (parallel reviewers, while Phase 4 setup begins)
- Phase 4: 30 min (sequential, main, debugging integration)
- Phase 5: 15 min (parallel cleanup)
- **Total: ~2 hours wall-clock** (vs ~8-10 hours single-threaded)

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Convex action time limits (10 min) | Per-repo summarization runs N=5 in parallel, chunked actions if needed |
| LinkedIn Browserbase port misses Python edge cases | SDUI text-parsing ported 1:1 (pure regex); only Selenium driver layer changes |
| GitHub OAuth scope insufficient for private repos | v2: optional "Include private repos" upgrade requesting `repo` scope |
| Cookie storage in Convex needs encryption | Use Convex env-bound encryption key wrapping; cookies never leave server |
| Subagents step on each other's files | Phase 1 (schema) finishes first; Phase 2 work is in disjoint folders; integration phase resolves the rare overlap |
| Subagent reports don't match reality | Apply "trust but verify" — main loop spot-checks 1-2 files per subagent return |
| Browserbase captcha during automated runs | Reuse stored `li_at` first; live-view URL fallback emits as warn event for UI to surface |
| Big-bang merge breaks something subtle | Phase 5 e2e-runner walks the full flow before declaring done |

## 13. Out of scope (explicitly)

- Removing recruit-main's existing `lib/scrapers/` — kept as fallback for v1, deleted in v2 cleanup
- Replacing recruit-main's existing onboarding 3D visual layer
- Migrating job-board ingestion (`lib/ingestion/`)
- Private GitHub repos (`repo` scope)
- Unit tests
- LinkedIn 2FA support beyond email-PIN challenge
- Manual profile editing UI (read-only display in v1; edit later via existing settings page)

## 14. Success criteria

A user signs in with GitHub. Within ~3 minutes (background) their `/profile` page shows:
- Identity from GitHub OAuth + READ data
- 10+ projects with code-grounded `whatItDoes` summaries (≥400 chars each, citing specific functions/files)
- Skills derived from manifest + language detection
- Optional: LinkedIn data if they pasted a URL during onboarding (experiences, education, publications, honors, interests)
- Graph view renders the project/skill/company/school constellation

The job-application agent (existing recruit-main feature) can immediately consume this richer profile to better tailor applications.
