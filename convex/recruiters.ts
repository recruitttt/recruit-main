import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("recruiters")
      .withIndex("by_user_status", q => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

export const getById = query({
  args: { recruiterId: v.id("recruiters") },
  handler: async (ctx, { recruiterId }) => {
    return await ctx.db.get(recruiterId);
  },
});

export const findByJobId = query({
  args: { jobId: v.id("applicationJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("recruiters")
      .withIndex("by_job", q => q.eq("jobId", jobId))
      .first();
  },
});

export const upsertRecruiter = mutation({
  args: {
    userId: v.string(),
    jobId: v.id("applicationJobs"),
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    recruiterName: v.string(),
    appearanceSeed: v.number(),
    positionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiters")
      .withIndex("by_user_position", q => q.eq("userId", args.userId).eq("positionIndex", args.positionIndex))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("recruiters", { ...args, status: "active", createdAt: now, updatedAt: now });
  },
});

export const setRecruiterStatus = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    status: v.union(v.literal("active"), v.literal("applied"), v.literal("departed")),
  },
  handler: async (ctx, { recruiterId, status }) => {
    await ctx.db.patch(recruiterId, { status, updatedAt: new Date().toISOString() });
  },
});

export const setCompanyContext = mutation({
  args: { recruiterId: v.id("recruiters"), companyContext: v.string() },
  handler: async (ctx, { recruiterId, companyContext }) => {
    await ctx.db.patch(recruiterId, {
      companyContext,
      contextFetchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getConversation = query({
  args: { recruiterId: v.id("recruiters") },
  handler: async (ctx, { recruiterId }) => {
    return await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", recruiterId))
      .first();
  },
});

const MAX_MESSAGES = 200;

export const appendMessage = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("recruiter"), v.literal("tool")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", args.recruiterId))
      .first();
    const message = {
      role: args.role,
      content: args.content,
      timestamp: now,
      toolCalls: args.toolCalls,
    };
    if (existing) {
      // Cap messages array to avoid hitting the 1MB Convex doc limit
      const next = [...existing.messages, message];
      const trimmed = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      await ctx.db.patch(existing._id, {
        messages: trimmed,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("recruiterConversations", {
        recruiterId: args.recruiterId,
        userId: args.userId,
        messages: [message],
        brainstormedAnswers: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const appendBrainstormedAnswer = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    questionType: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, { recruiterId, questionType, answer }) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", recruiterId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      brainstormedAnswers: [
        ...existing.brainstormedAnswers,
        { questionType, answer, extractedAt: now },
      ],
      updatedAt: now,
    });
  },
});
