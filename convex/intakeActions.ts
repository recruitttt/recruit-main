//
// intakeActions — long-running Convex actions for adapter dispatch.
//
// Adapters (github, resume, web, chat) register their entry-point actions
// here, e.g.
//   export const runGithubIntake = action({ ... })
//   export const runResumeIntake = action({ ... })
//
// Each action wraps `runIntake(adapter, input, ctx)` from
// `lib/intake/shared/runIntake.ts`. The auth callback (`convex/auth.ts`) and
// the onboarding pages can fire these via `ctx.scheduler.runAfter(0, ...)`.
//
// LinkedIn intake lives at `app/api/intake/linkedin/route.ts` because its
// adapter pulls `playwright-core`, which the Convex Node bundler cannot
// analyze (see spec §11.2 / §13).
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §10.

"use node";

import { actionGeneric, anyApi } from "convex/server";
import { v } from "convex/values";

import { getGitHubAccessToken } from "../lib/auth-github";

import { githubAdapter } from "../lib/intake/github/adapter";
import { chatAdapter } from "../lib/intake/chat/adapter";
import { resumeAdapter } from "../lib/intake/resume/adapter";
import { webAdapter } from "../lib/intake/web/adapter";
// NOTE: `linkedinAdapter` deliberately NOT imported. The LinkedIn pipeline
// pulls `playwright-core` (via @browserbasehq/sdk), and the Convex Node
// bundler crashes when analyzing playwright at deploy time. The LinkedIn
// intake therefore runs as a Next.js API route at
// `app/api/intake/linkedin/route.ts` (per spec §11.2 / §13).
import { runIntake } from "../lib/intake/shared/runIntake";

import type { ActionCtx } from "./_generated/server";
import type { AICredentials, IntakeContext } from "../lib/intake/shared";

const action = actionGeneric;

// ---------------------------------------------------------------------------
// runGithubIntake — fetches the better-auth GitHub access token, then runs
// the adapter via `runIntake`. The adapter is responsible for persisting the
// snapshot, sharded source files, and per-repo summaries directly — keeping
// the live `intakeRuns` events small enough to fit Convex's per-doc 1MB cap.
// ---------------------------------------------------------------------------

export const runGithubIntake = action({
  args: { userId: v.string(), force: v.optional(v.boolean()) },
  returns: v.object({ runId: v.string(), events: v.number() }),
  handler: async (ctx, args): Promise<{ runId: string; events: number }> => {
    if (!args.force) {
      const existingRun = (await ctx.runQuery(
        anyApi.intakeRuns.latestForUserKindInternal,
        { userId: args.userId, kind: "github" }
      )) as { _id?: string; status?: string; events?: unknown[] } | null;

      if (existingRun && existingRun.status !== "failed") {
        return {
          runId: String(existingRun._id ?? ""),
          events: Array.isArray(existingRun.events) ? existingRun.events.length : 0,
        };
      }
    }

    const token = await getGitHubAccessToken(ctx, args.userId);
    if (!token) {
      throw new Error(
        "No GitHub access token found for user. Sign in with GitHub OAuth first.",
      );
    }

    const credentials = resolveAICredentials();

    const intakeContext: IntakeContext = {
      userId: args.userId,
      ctx: ctx as unknown as ActionCtx,
      credentials,
      now: () => new Date().toISOString(),
    };

    return await runIntake(githubAdapter, { token }, intakeContext);
  },
});

function resolveAICredentials(): AICredentials {
  const gateway = process.env.AI_GATEWAY_API_KEY;
  if (gateway) return { source: "gateway", apiKey: gateway };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { source: "anthropic", apiKey: anthropic };
  throw new Error(
    "No AI credentials configured. Set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY in the Convex deployment.",
  );
}

// ---------------------------------------------------------------------------
// Resume / Web / Chat intake actions (spec §7.3, §7.4, §7.5).
//
// These adapters reuse the existing scrapers under `lib/scrapers` and the
// resume PDF/LLM pipeline (factored from `app/api/parse/resume`). They share
// the same `runIntake` driver so all events stream through `intakeRuns` and
// any patches merge into `userProfiles`.
//
// AI credentials are resolved softly — these adapters use OPENAI_API_KEY
// directly (not Anthropic) so a missing AI gateway / Anthropic key is not
// fatal; the adapter degrades to "raw text only" / "scrape only" mode.
// ---------------------------------------------------------------------------

const webKindValidator = v.union(
  v.literal("devpost"),
  v.literal("website"),
  v.literal("linkedin"),
  v.literal("github"),
);

const chatRoleValidator = v.union(v.literal("user"), v.literal("assistant"));

function resolveSoftAICredentials(): AICredentials {
  const gateway = process.env.AI_GATEWAY_API_KEY;
  if (gateway) return { source: "gateway", apiKey: gateway };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { source: "anthropic", apiKey: anthropic };
  // Resume / web / chat use OPENAI_API_KEY directly; surface a placeholder
  // so the IntakeContext type contract stays satisfied.
  return { source: "anthropic", apiKey: "" };
}

function buildIntakeContext(ctx: ActionCtx, userId: string): IntakeContext {
  return {
    userId,
    ctx,
    credentials: resolveSoftAICredentials(),
    now: () => new Date().toISOString(),
  };
}

export const runResumeIntake = action({
  args: {
    userId: v.string(),
    fileId: v.id("_storage"),
    filename: v.optional(v.string()),
  },
  returns: v.object({ runId: v.string(), events: v.number() }),
  handler: async (ctx, args): Promise<{ runId: string; events: number }> => {
    const intakeCtx = buildIntakeContext(ctx as unknown as ActionCtx, args.userId);
    return await runIntake(
      resumeAdapter,
      { fileId: args.fileId, filename: args.filename },
      intakeCtx,
    );
  },
});

export const runWebIntake = action({
  args: {
    userId: v.string(),
    url: v.string(),
    kind: webKindValidator,
  },
  returns: v.object({ runId: v.string(), events: v.number() }),
  handler: async (ctx, args): Promise<{ runId: string; events: number }> => {
    const intakeCtx = buildIntakeContext(ctx as unknown as ActionCtx, args.userId);
    return await runIntake(
      webAdapter,
      { url: args.url, kind: args.kind },
      intakeCtx,
    );
  },
});

// NOTE: `runLinkedinIntake` previously lived here but moved to
// `app/api/intake/linkedin/route.ts` because the LinkedIn adapter pulls
// `playwright-core` and the Convex bundler can't ship that. The route
// uses the same `linkedinAdapter` and writes to the same `intakeRuns` table,
// so the onboarding `useQuery(api.intakeRuns.byUserKind, ...)` badges keep
// working without changes.

export const runChatIntake = action({
  args: {
    userId: v.string(),
    messages: v.array(
      v.object({
        role: chatRoleValidator,
        content: v.string(),
      }),
    ),
    extractTargets: v.array(v.string()),
  },
  returns: v.object({ runId: v.string(), events: v.number() }),
  handler: async (ctx, args): Promise<{ runId: string; events: number }> => {
    const intakeCtx = buildIntakeContext(ctx as unknown as ActionCtx, args.userId);
    return await runIntake(
      chatAdapter,
      { messages: args.messages, extractTargets: args.extractTargets },
      intakeCtx,
    );
  },
});
