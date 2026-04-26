/* eslint-disable @typescript-eslint/no-explicit-any */
//
// githubSnapshots — latest raw GitHub snapshot per user.
// Replaces existing row on save (we keep only the most recent).

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const latest = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("githubSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return row ?? null;
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    raw: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("githubSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fetchedAt: now,
        raw: args.raw,
      });
      return existing._id;
    }

    return await ctx.db.insert("githubSnapshots", {
      userId: args.userId,
      fetchedAt: now,
      raw: args.raw,
    });
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
