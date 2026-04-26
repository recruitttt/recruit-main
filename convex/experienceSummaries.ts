/* eslint-disable @typescript-eslint/no-explicit-any */
//
// experienceSummaries — per-experience Haiku summaries (LinkedIn experience entries).

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const listByUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experienceSummaries")
      .withIndex("by_user_exp", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const byUserExperience = query({
  args: { userId: v.string(), experienceKey: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("experienceSummaries")
      .withIndex("by_user_exp", (q: any) =>
        q.eq("userId", args.userId).eq("experienceKey", args.experienceKey)
      )
      .unique();
    return row ?? null;
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    experienceKey: v.string(),
    sourceContentHash: v.string(),
    summary: v.any(),
    generatedByModel: v.string(),
    generatedAt: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("experienceSummaries")
      .withIndex("by_user_exp", (q: any) =>
        q.eq("userId", args.userId).eq("experienceKey", args.experienceKey)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceContentHash: args.sourceContentHash,
        summary: args.summary,
        generatedByModel: args.generatedByModel,
        generatedAt: args.generatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("experienceSummaries", {
      userId: args.userId,
      experienceKey: args.experienceKey,
      sourceContentHash: args.sourceContentHash,
      summary: args.summary,
      generatedByModel: args.generatedByModel,
      generatedAt: args.generatedAt,
    });
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("experienceSummaries")
      .withIndex("by_user_exp", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});
