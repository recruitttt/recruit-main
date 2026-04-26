/* eslint-disable @typescript-eslint/no-explicit-any */
//
// intakeRuns — live progress stream for every adapter run.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §4 + §10
//
// UI subscribes via `useQuery(api.intakeRuns.byUserKind, ...)` and Convex
// push-updates the events array in real time.

import {
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;
const internalQuery = internalQueryGeneric;

const kindValidator = v.union(
  v.literal("github"),
  v.literal("linkedin"),
  v.literal("resume"),
  v.literal("web"),
  v.literal("chat"),
  v.literal("ai-report")
);

const MAX_EVENTS_PER_RUN = 500;

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

// Most recent run for a given (userId, kind).
export const byUserKind = query({
  args: { userId: v.string(), kind: kindValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const rows = await ctx.db
      .query("intakeRuns")
      .withIndex("by_user_kind", (q: any) =>
        q.eq("userId", args.userId).eq("kind", args.kind)
      )
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

// Recent N runs for a user across all kinds (for live UI streaming).
export const live = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return await ctx.db
      .query("intakeRuns")
      .withIndex("by_user_kind", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const byId = query({
  args: { runId: v.id("intakeRuns") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const latestForUserKindInternal = internalQuery({
  args: { userId: v.string(), kind: kindValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("intakeRuns")
      .withIndex("by_user_kind", (q: any) =>
        q.eq("userId", args.userId).eq("kind", args.kind)
      )
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const start = mutation({
  args: {
    userId: v.string(),
    kind: kindValidator,
  },
  returns: v.id("intakeRuns"),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("intakeRuns", {
      userId: args.userId,
      kind: args.kind,
      status: "running",
      events: [],
      startedAt: now,
    });
  },
});

export const appendEvent = mutation({
  args: {
    runId: v.id("intakeRuns"),
    event: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    const existingEvents = Array.isArray((run as { events?: unknown }).events)
      ? ((run as { events: unknown[] }).events as unknown[])
      : [];
    const nextEvents = [...existingEvents, args.event].slice(-MAX_EVENTS_PER_RUN);
    await ctx.db.patch(args.runId, { events: nextEvents });
    return null;
  },
});

export const complete = mutation({
  args: { runId: v.id("intakeRuns") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.patch(args.runId, {
      status: "completed",
      completedAt: now,
    });
    return null;
  },
});

export const fail = mutation({
  args: {
    runId: v.id("intakeRuns"),
    error: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.patch(args.runId, {
      status: "failed",
      completedAt: now,
      error: args.error,
    });
    return null;
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("intakeRuns")
      .withIndex("by_user_kind", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});

// summary — one row per intake `kind` summarizing the latest run state for
// the requesting user. Used by the Ready Room status pills and by the
// onboarding launch-pipeline gate to refuse start when an intake is still
// `running` (unless `force: true`).
//
// Returns one entry for every kind in INTAKE_KINDS — `status: "none"` when no
// run row exists for that user+kind. The launch-pipeline route inspects the
// `running` entries to decide whether to short-circuit with HTTP 409.
const INTAKE_KINDS = [
  "github",
  "linkedin",
  "resume",
  "web",
  "chat",
  "ai-report",
] as const;

type IntakeKind = (typeof INTAKE_KINDS)[number];

interface IntakeSummaryEntry {
  kind: IntakeKind;
  status: "pending" | "running" | "completed" | "failed" | "none";
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export const summary = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);

    const out: IntakeSummaryEntry[] = [];
    for (const kind of INTAKE_KINDS) {
      const rows = await ctx.db
        .query("intakeRuns")
        .withIndex("by_user_kind", (q: any) =>
          q.eq("userId", args.userId).eq("kind", kind)
        )
        .order("desc")
        .take(1);
      const row = rows[0] as
        | {
            status: "queued" | "running" | "completed" | "failed";
            startedAt?: string;
            completedAt?: string;
            error?: string;
          }
        | undefined;

      if (!row) {
        out.push({ kind, status: "none" });
        continue;
      }

      // Map the table's "queued" status to the public-facing "pending" so
      // callers don't need to track Convex-internal vocabulary.
      const status: IntakeSummaryEntry["status"] =
        row.status === "queued" ? "pending" : row.status;
      out.push({
        kind,
        status,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        errorMessage: row.error,
      });
    }

    return out;
  },
});
