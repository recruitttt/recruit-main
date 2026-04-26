/* eslint-disable @typescript-eslint/no-explicit-any */
//
// aiReports — Sonnet consolidated AI report (one per user, replaces on regeneration).

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const byUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("aiReports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return row ?? null;
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    report: v.any(),
    generatedByModel: v.string(),
    generatedAt: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiReports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        report: args.report,
        generatedByModel: args.generatedByModel,
        generatedAt: args.generatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("aiReports", {
      userId: args.userId,
      report: args.report,
      generatedByModel: args.generatedByModel,
      generatedAt: args.generatedAt,
    });
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiReports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
