# Recruit Developer Guide

## Overview

Recruit unifies job seeker profile inference via intake adapters (GitHub, LinkedIn, Resume, Web, Chat). Each adapter implements a contract that yields real-time progress events; the `runIntake` driver persists them to Convex `intakeRuns` for live UI streaming and merges patches into the canonical `userProfiles` doc. The architecture is in [specs/2026-04-25-recruit-merge-design.md](docs/superpowers/specs/2026-04-25-recruit-merge-design.md).

## Adapter pattern (mandatory)

Every new data source MUST implement `IntakeAdapter<TInput>` from `lib/intake/shared/types.ts`:

```ts
interface IntakeAdapter<TInput> {
  name: IntakeAdapterName;  // "github" | "linkedin" | "resume" | "web" | "chat"
  run(input: TInput, ctx: IntakeContext): AsyncIterable<IntakeProgressEvent>;
}
```

Adapters yield `IntakeProgressEvent` objects with:
- `stage`, `message` — UI progress display
- `done`, `total` — progress bar numerator/denominator
- `patch?: Partial<UserProfile>` — merged into the profile
- `provenance?: Record<string, ProvenanceSource>` — field-path → source attribution
- `data?: Record<string, unknown>` — structured payload for the UI (e.g., live-view URL, repo name)

**Never** write directly to Convex; use `ctx.runMutation`/`ctx.runQuery` only. The driver sanitizes events before persisting to prevent cookie/token leaks.

## Security checklist

- Every Convex query/mutation: call `requireOwner(ctx, userId)` at the top
- Never include cookies, API tokens, or `liveViewUrl`s in event `data` fields
- Use `internalQuery` for secrets only; call it within the Convex backend, not from adapters
- LinkedIn `liAt` cookie is encrypted with AES-256-GCM (`lib/server/encrypt.ts`); decrypt via `getDecryptedLiAt()`
- Event sanitizer in `runIntake` strips sensitive `data`/`patch` fields before persisting

## LinkedIn special case

LinkedIn scraping runs as a Next.js API route (`app/api/intake/linkedin/route.ts`), not a Convex action, because playwright-core is not bundleable by Convex. The route streams SSE events and calls the same `runIntake` driver via `convexHttpClientToCtx` shim (`lib/intake/runIntakeNode.ts`).

## Provenance

Every UserProfile field write must include provenance tracking:
```ts
provenance: {
  "skills": "github",      // Field path → source
  "experience.0.title": "linkedin",
  "summary": "manual"
}
```

This supports multi-source conflict resolution in the UI.

## Phase 4 (deferred)

`runAiReport` (Sonnet consolidation) is TODO. The legacy `/api/onboarding/launch-pipeline` endpoint still fires as the onboarding final step; this will be replaced with a proper `ai-report` intake adapter.

## Next.js + Convex notes

- Use `useQuery(api.module.method, {})` for live subscriptions from the client
- Call Convex mutations from Next API routes via `ConvexHttpClient`
- `session.create.after` hook auto-fires GitHub intake on OAuth callback
- The app uses Turbopack; bundler errors may differ from webpack
