/* eslint-disable @typescript-eslint/no-explicit-any */
//
// repoSummaries — per-repo Haiku summaries with content-hash cache invalidation.

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const listByUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repoSummaries")
      .withIndex("by_user_repo", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const byUserRepo = query({
  args: { userId: v.string(), repoFullName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("repoSummaries")
      .withIndex("by_user_repo", (q: any) =>
        q.eq("userId", args.userId).eq("repoFullName", args.repoFullName)
      )
      .unique();
    return row ?? null;
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    repoFullName: v.string(),
    sourceContentHash: v.string(),
    summary: v.any(),
    generatedByModel: v.string(),
    generatedAt: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repoSummaries")
      .withIndex("by_user_repo", (q: any) =>
        q.eq("userId", args.userId).eq("repoFullName", args.repoFullName)
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

    return await ctx.db.insert("repoSummaries", {
      userId: args.userId,
      repoFullName: args.repoFullName,
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
      .query("repoSummaries")
      .withIndex("by_user_repo", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});
