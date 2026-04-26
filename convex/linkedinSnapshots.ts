/* eslint-disable @typescript-eslint/no-explicit-any */
//
// linkedinSnapshots — latest LinkedIn scrape result per user.

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

export const latest = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const row = await ctx.db
      .query("linkedinSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return row ?? null;
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    profileUrl: v.string(),
    raw: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("linkedinSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fetchedAt: now,
        profileUrl: args.profileUrl,
        raw: args.raw,
      });
      return existing._id;
    }

    return await ctx.db.insert("linkedinSnapshots", {
      userId: args.userId,
      fetchedAt: now,
      profileUrl: args.profileUrl,
      raw: args.raw,
    });
  },
});

export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existing = await ctx.db
      .query("linkedinSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
