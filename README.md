# Recruit — Autonomous job-application agent

Unified profile inference engine + onboarding flow for job seekers. Merges data from GitHub, LinkedIn, résumé, and user input via a pluggable intake adapter contract. Real-time progress streaming to the dashboard.

## What's new

The codebase recently absorbed the **gh-applicant** project, adding a real Convex backend with six intake adapters (GitHub, LinkedIn, Resume, Web, Chat). See [specs/2026-04-25-recruit-merge-design.md](docs/superpowers/specs/2026-04-25-recruit-merge-design.md) for the architecture.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page — hero, live agent ticker, demo dashboard preview |
| `/onboarding` | 6-step intake flow: role → resume → links → email → connect → prefs |
| `/profile?view=data\|graph` | Dual-view dashboard: data grid (7 sections, 8 live subscriptions) or knowledge graph |
| `/sign-in`, `/sign-up` | Auth flows with GitHub OAuth + email/password |
| `/pricing` | Pricing tiers (Free/Standard/Pro mockup) |
| `/api/intake/linkedin` | LinkedIn scraping via Browserbase + Playwright (SSE streaming) |

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, TypeScript)
- **Database**: Convex (real-time DB + better-auth with GitHub OAuth)
- **Auth**: better-auth 1.x (email/password + GitHub OAuth `read:user user:email read:org`; account linking enabled)
- **UI**: React 19, Tailwind v4, motion (Framer Motion successor), lucide-react
- **Data ingest**: Octokit REST + GraphQL, Browserbase + playwright-core, Anthropic AI SDK v6 (Claude Haiku/Sonnet)
- **Scraping**: Browserbase sessions for LinkedIn, per-session PIN file in `/tmp`, encrypted cookies (AES-256-GCM)
- **Fonts**: Inter (UI), Instrument Serif (hero), JetBrains Mono (metrics)

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Required environment variables

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
CONVEX_DEPLOYMENT=prod

# Auth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_SITE_URL=https://your-app.example.com  # production fallback
ADDITIONAL_TRUSTED_ORIGINS=                       # optional previews, comma-separated

# AI
ANTHROPIC_API_KEY=...

# LinkedIn scraping
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
COOKIE_ENCRYPTION_KEY=...  # 32-byte hex for AES-256-GCM

# Optional
NEXT_PUBLIC_GITHUB_OWNER=...  # For private repo scraping
```

## Convex env setup

Set secrets in the Convex deployment:

```bash
npx convex env set GITHUB_CLIENT_ID <id>
npx convex env set GITHUB_CLIENT_SECRET <secret>
npx convex env set SITE_URL <https://your-app.example.com>
npx convex env set ANTHROPIC_API_KEY <key>
```

LinkedIn scraping runs in the Next.js route, not Convex, so configure
`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `LINKEDIN_EMAIL`, and
`LINKEDIN_PASSWORD` in the Next/Vercel runtime environment.

## GitHub OAuth callback

Register this URL with GitHub as your authorized callback:

```
https://<NEXT_PUBLIC_CONVEX_SITE_URL>/api/auth/callback/github
```

The app always asks GitHub to return to the Convex callback URL, then exchanges a one-time token through `/api/auth/complete-oauth` so cookies are set on the active app origin (`localhost`, production, or an allowed preview). Keep the GitHub OAuth app callback pointed at the Convex URL above; add any non-local preview hosts to `ADDITIONAL_TRUSTED_ORIGINS`.

The `session.create.after` hook auto-fires a GitHub intake run (deduped, allows retry on failed status).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ UI Layer (React components + Convex subscriptions)      │
├─────────────────────────────────────────────────────────┤
│ Intake Adapters (GitHub, LinkedIn, Resume, Web, Chat)   │
│ Implement IntakeAdapter<TInput> → AsyncIterable<Event>  │
├─────────────────────────────────────────────────────────┤
│ runIntake driver (merges patches + persists events)     │
├─────────────────────────────────────────────────────────┤
│ Convex Tables:                                          │
│  • userProfiles (canonical blob + provenance log)       │
│  • intakeRuns (live event stream per adapter)           │
│  • githubSnapshots, repoSummaries, repoSourceFiles      │
│  • linkedinSnapshots, linkedinCookies (encrypted)       │
│  • experienceSummaries, aiReports                       │
└─────────────────────────────────────────────────────────┘
```

**Data flow**: Each adapter yields `IntakeProgressEvent` (stage, message, patch, provenance, data). The `runIntake` driver iterates the adapter, persists sanitized events to `intakeRuns` for UI streaming, and merges `patch` fields into the canonical `userProfiles` doc. Provenance is tracked per field path to support multi-source disambiguation.

## Adding a new intake adapter

1. Create a new module in `lib/intake/<source>/`
2. Implement `IntakeAdapter<TInput>` from `lib/intake/shared/types.ts`:
   - `name: IntakeAdapterName` — the adapter's kind (e.g., `"github"`)
   - `run(input, ctx)` — async generator yielding `IntakeProgressEvent`s
3. Yield events with `stage`, `message`, optional `done`/`total`, `patch` (partial profile update), `provenance` (field-path → source), and structured `data` (for UI)
4. Call `ctx.runMutation`/`ctx.runQuery` to interact with Convex (never write directly)
5. Register the adapter in the driver (see `lib/intake/runIntake.ts`)

**Example**: GitHub adapter pre-fetches repo source files via Octokit (40 files / 250 KB per repo), generates Haiku summaries per repo (cached by tree-SHA), and yields events for each stage (fetch, summarize, persist).

LinkedIn scraping runs as a Next.js API route (`app/api/intake/linkedin/route.ts`) because Convex's Node bundler cannot analyze playwright-core. It streams SSE events and persists the same `intakeRuns` table.
