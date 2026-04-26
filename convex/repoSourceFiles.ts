/* eslint-disable @typescript-eslint/no-explicit-any */
//
// repoSourceFiles — bulk pre-fetched source files per repo.
// Sharded out from githubSnapshots to avoid the 1MB document limit.

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const byUserRepo = query({
  args: { userId: v.string(), repoFullName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("repoSourceFiles")
      .withIndex("by_user_repo", (q: any) =>
        q.eq("userId", args.userId).eq("repoFullName", args.repoFullName)
      )
      .unique();
    return row ?? null;
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repoSourceFiles")
      .withIndex("by_user_repo", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    repoFullName: v.string(),
    files: v.array(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("repoSourceFiles")
      .withIndex("by_user_repo", (q: any) =>
        q.eq("userId", args.userId).eq("repoFullName", args.repoFullName)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        files: args.files,
        fetchedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("repoSourceFiles", {
      userId: args.userId,
      repoFullName: args.repoFullName,
      files: args.files,
      fetchedAt: now,
    });
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("repoSourceFiles")
      .withIndex("by_user_repo", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});
