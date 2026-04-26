/* eslint-disable @typescript-eslint/no-explicit-any */

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { mockDLQItems } from "../lib/mock-data";

const query = queryGeneric;
const mutation = mutationGeneric;
const DEMO_USER_ID = "demo";

type DecisionStatus = "open" | "cached" | "skipped" | "resolved";

async function scopedDemoUserId(ctx: any, requestedDemoUserId?: string) {
  if (requestedDemoUserId) return requestedDemoUserId;
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ? `auth:${identity.subject}` : DEMO_USER_ID;
}

function serializeItem(item: (typeof mockDLQItems)[number], decision?: any) {
  const status = (decision?.status ?? "open") as DecisionStatus;
  return {
    ...item,
    status,
    answer: typeof decision?.answer === "string" ? decision.answer : undefined,
    resolvedAt: typeof decision?.resolved_at === "string" ? decision.resolved_at : undefined,
    updatedAt: typeof decision?.updated_at === "string" ? decision.updated_at : undefined,
  };
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

async function findDecision(ctx: any, demoUserId: string, itemId: string) {
  const rows = await ctx.db
    .query("dlq_items")
    .withIndex("by_user", (q: any) => q.eq("user_id", demoUserId))
    .collect();
  return rows.find((row: any) => row.item_id === itemId);
}

async function upsertDecision(
  ctx: any,
  args: {
    demoUserId: string;
    itemId: string;
    status: DecisionStatus;
    answer?: string;
  }
) {
  const now = new Date().toISOString();
  const item = mockDLQItems.find((candidate) => candidate.id === args.itemId);
  const existing = await findDecision(ctx, args.demoUserId, args.itemId);
  const patch = omitUndefined({
    user_id: args.demoUserId,
    item_id: args.itemId,
    status: args.status,
    answer: args.answer,
    application_id: item?.applicationId,
    company: item?.company,
    role: item?.role,
    question: item?.question,
    updated_at: now,
    resolved_at: args.status === "open" ? undefined : now,
  });

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  }

  const id = await ctx.db.insert("dlq_items", {
    ...patch,
    created_at: now,
  });
  return await ctx.db.get(id);
}

export const listDemoQueue = query({
  args: { demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const decisions = await ctx.db
      .query("dlq_items")
      .withIndex("by_user", (q: any) => q.eq("user_id", demoUserId))
      .collect();
    const byItemId = new Map(decisions.map((decision: any) => [decision.item_id, decision]));
    const items = mockDLQItems.map((item) => serializeItem(item, byItemId.get(item.id)));
    return {
      items,
      openCount: items.filter((item) => item.status === "open").length,
      resolvedCount: items.filter((item) => item.status !== "open").length,
    };
  },
});

export const approveAndCache = mutation({
  args: {
    itemId: v.string(),
    answer: v.string(),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await upsertDecision(ctx, {
      demoUserId: await scopedDemoUserId(ctx, args.demoUserId),
      itemId: args.itemId,
      status: "cached",
      answer: args.answer,
    });
  },
});

export const skipRole = mutation({
  args: {
    itemId: v.string(),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await upsertDecision(ctx, {
      demoUserId: await scopedDemoUserId(ctx, args.demoUserId),
      itemId: args.itemId,
      status: "skipped",
    });
  },
});

export const markResolved = mutation({
  args: {
    itemId: v.string(),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await upsertDecision(ctx, {
      demoUserId: await scopedDemoUserId(ctx, args.demoUserId),
      itemId: args.itemId,
      status: "resolved",
    });
  },
});
