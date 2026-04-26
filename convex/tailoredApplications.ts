/* eslint-disable @typescript-eslint/no-explicit-any */

import { queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;

const DEMO_USER_ID = "demo";

async function scopedDemoUserId(ctx: any, requestedUserId?: string) {
  if (requestedUserId) return requestedUserId;
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ? `auth:${identity.subject}` : DEMO_USER_ID;
}

function deriveCompanyTitle(row: any): { company: string | undefined; title: string | undefined } {
  const job = row?.job ?? {};
  return {
    company: row?.company ?? job?.company ?? job?.companyName ?? undefined,
    title: row?.title ?? job?.title ?? job?.role ?? undefined,
  };
}

export const listForUser = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.userId);
    const limit = Math.min(args.limit ?? 25, 100);
    const rows = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_demo_user", (q: any) => q.eq("demoUserId", demoUserId))
      .order("desc")
      .take(limit);
    return rows.map((row: any) => {
      const { company, title } = deriveCompanyTitle(row);
      return {
        _id: row._id,
        jobId: row.jobId,
        company,
        title,
        status: row.status,
        tailoringScore: row.tailoringScore,
        keywordCoverage: row.keywordCoverage,
        pdfReady: row.pdfReady,
        pdfFilename: row.pdfFilename,
        pdfByteLength: row.pdfByteLength,
        updatedAt: row.updatedAt,
      };
    });
  },
});

export const listTopForUser = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.userId);
    const limit = Math.min(args.limit ?? 5, 20);
    const rows = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_demo_user", (q: any) => q.eq("demoUserId", demoUserId))
      .collect();
    const completed = rows.filter((r: any) => r.status === "completed");
    completed.sort(
      (a: any, b: any) =>
        (b.tailoringScore ?? 0) - (a.tailoringScore ?? 0)
    );
    return completed.slice(0, limit).map((row: any) => {
      const { company, title } = deriveCompanyTitle(row);
      return {
        _id: row._id,
        jobId: row.jobId,
        company,
        title,
        tailoringScore: row.tailoringScore,
      };
    });
  },
});

export const getByJobId = query({
  args: { jobId: v.id("ingestedJobs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .collect();
    return rows[0] ?? null;
  },
});
