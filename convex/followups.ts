/* eslint-disable @typescript-eslint/no-explicit-any */

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import {
  buildDefaultFollowUpTasks,
  generateOutreachDraft,
  nextOpenFollowUpAt,
  type ApplicationStatus,
  type FollowUpTaskState,
} from "../lib/followups";

const query = queryGeneric;
const mutation = mutationGeneric;

const DEMO_USER_ID = "demo";

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("ready_to_apply"),
  v.literal("applied"),
  v.literal("follow_up_due"),
  v.literal("followed_up"),
  v.literal("responded"),
  v.literal("interview"),
  v.literal("rejected"),
  v.literal("offer"),
  v.literal("closed"),
  v.literal("blocked")
);

const channelValidator = v.union(
  v.literal("email"),
  v.literal("linkedin"),
  v.literal("manual")
);

export const listApplications = query({
  args: {
    demoUserId: v.optional(v.string()),
    status: v.optional(statusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const limit = boundedLimit(args.limit, 100);
    const docs = args.status
      ? await ctx.db
          .query("applications")
          .withIndex("by_demo_user_status", (q) =>
            q.eq("demoUserId", demoUserId)
          )
          .filter((q) => q.eq(q.field("status"), args.status as ApplicationStatus))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("applications")
          .withIndex("by_demo_user_updated", (q) =>
            q.eq("demoUserId", demoUserId)
          )
          .order("desc")
          .take(limit);

    return docs;
  },
});

export const listDueFollowUps = query({
  args: {
    demoUserId: v.optional(v.string()),
    now: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const now = args.now ?? new Date().toISOString();
    const limit = boundedLimit(args.limit, 50);
    const scheduled = await tasksByStateBefore(ctx, demoUserId, "scheduled", now, limit);
    const draftReady = await tasksByStateBefore(ctx, demoUserId, "draft_ready", now, limit);
    return await enrichTasks(ctx, [...scheduled, ...draftReady].slice(0, limit));
  },
});

export const followUpSummary = query({
  args: {
    demoUserId: v.optional(v.string()),
    now: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const now = args.now ?? new Date().toISOString();
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_demo_user_updated", (q) => q.eq("demoUserId", demoUserId))
      .order("desc")
      .take(80);

    const scheduled = await tasksByState(ctx, demoUserId, "scheduled", 100);
    const draftReady = await tasksByState(ctx, demoUserId, "draft_ready", 100);
    const openTasks = [...scheduled, ...draftReady].sort((a, b) =>
      a.scheduledFor.localeCompare(b.scheduledFor)
    );
    const dueTasks = openTasks.filter((task) => task.scheduledFor <= now);

    return {
      applications,
      dueTasks: await enrichTasks(ctx, dueTasks.slice(0, 25)),
      scheduledTasks: await enrichTasks(ctx, openTasks.slice(0, 25)),
      counts: {
        applications: applications.length,
        applied: applications.filter((app) => app.status === "applied").length,
        due: dueTasks.length,
        responses: applications.filter((app) =>
          ["responded", "interview", "rejected", "offer"].includes(app.status)
        ).length,
        interviews: applications.filter((app) => app.status === "interview").length,
        rejectedClosed: applications.filter((app) =>
          ["rejected", "closed"].includes(app.status)
        ).length,
      },
    };
  },
});

export const upsertApplication = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    applicationId: v.optional(v.id("applications")),
    jobId: v.optional(v.id("ingestedJobs")),
    company: v.string(),
    title: v.string(),
    provider: v.optional(v.string()),
    jobUrl: v.optional(v.string()),
    status: v.optional(statusValidator),
    appliedAt: v.optional(v.string()),
    responseAt: v.optional(v.string()),
    responseSummary: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("applications"),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const now = new Date().toISOString();
    const status = args.status ?? "draft";
    const appliedAt =
      args.appliedAt ?? (status === "applied" ? now : undefined);
    const existing = args.applicationId
      ? await ctx.db.get(args.applicationId)
      : args.jobId
        ? await ctx.db
            .query("applications")
            .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
            .filter((q) => q.eq(q.field("demoUserId"), demoUserId))
            .first()
        : null;

    const doc = omitUndefined({
      demoUserId,
      jobId: args.jobId,
      company: args.company.trim(),
      title: args.title.trim(),
      provider: args.provider?.trim() || "manual",
      jobUrl: args.jobUrl,
      status,
      appliedAt,
      lastStatusAt: now,
      responseAt: args.responseAt,
      responseSummary: args.responseSummary,
      metadata: args.metadata,
      updatedAt: now,
    });

    const applicationId = existing
      ? (await ctx.db.patch(existing._id, doc), existing._id)
      : await ctx.db.insert("applications", {
          ...doc,
          createdAt: now,
        });

    const application = await ctx.db.get(applicationId);
    if (application?.status === "applied" && application.appliedAt) {
      await ensureDefaultFollowUps(ctx, application);
    }
    await refreshNextFollowUpAt(ctx, applicationId);
    return applicationId;
  },
});

export const transitionApplicationStatus = mutation({
  args: {
    applicationId: v.id("applications"),
    status: statusValidator,
    appliedAt: v.optional(v.string()),
    responseAt: v.optional(v.string()),
    responseSummary: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db.get(args.applicationId);
    if (!existing) throw new Error("application_not_found");
    const appliedAt =
      args.appliedAt ?? existing.appliedAt ?? (args.status === "applied" ? now : undefined);
    const responseAt =
      args.responseAt ??
      existing.responseAt ??
      (isResponseStatus(args.status) ? now : undefined);

    await ctx.db.patch(args.applicationId, omitUndefined({
      status: args.status,
      appliedAt,
      lastStatusAt: now,
      responseAt,
      responseSummary: args.responseSummary,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: now,
    }));

    const application = await ctx.db.get(args.applicationId);
    if (application?.status === "applied" && application.appliedAt) {
      await ensureDefaultFollowUps(ctx, application);
    }
    await refreshNextFollowUpAt(ctx, args.applicationId);
    return null;
  },
});

export const scheduleFollowUp = mutation({
  args: {
    applicationId: v.id("applications"),
    channel: channelValidator,
    scheduledFor: v.string(),
  },
  returns: v.id("followUpTasks"),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("application_not_found");
    const now = new Date().toISOString();
    const taskId = await ctx.db.insert("followUpTasks", {
      demoUserId: application.demoUserId,
      applicationId: args.applicationId,
      channel: args.channel,
      state: "scheduled",
      scheduledFor: args.scheduledFor,
      createdAt: now,
      updatedAt: now,
    });
    await refreshNextFollowUpAt(ctx, args.applicationId);
    return taskId;
  },
});

export const rescheduleFollowUp = mutation({
  args: {
    taskId: v.id("followUpTasks"),
    scheduledFor: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    await ctx.db.patch(args.taskId, {
      scheduledFor: args.scheduledFor,
      state: "scheduled",
      updatedAt: new Date().toISOString(),
    });
    await refreshNextFollowUpAt(ctx, task.applicationId);
    return null;
  },
});

export const skipFollowUp = mutation({
  args: { taskId: v.id("followUpTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    await ctx.db.patch(args.taskId, {
      state: "skipped",
      updatedAt: new Date().toISOString(),
    });
    await refreshNextFollowUpAt(ctx, task.applicationId);
    return null;
  },
});

export const createOutreachDraft = mutation({
  args: {
    applicationId: v.id("applications"),
    taskId: v.optional(v.id("followUpTasks")),
    channel: channelValidator,
    profile: v.optional(v.any()),
    recipient: v.optional(v.string()),
    tone: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  returns: v.id("outreachDrafts"),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("application_not_found");
    const content = generateOutreachDraft({
      application,
      channel: args.channel,
      profile: args.profile,
      recipient: args.recipient,
      tone: args.tone,
      source: args.source,
    });
    const now = new Date().toISOString();
    const draftId = await ctx.db.insert("outreachDrafts", omitUndefined({
      demoUserId: application.demoUserId,
      applicationId: args.applicationId,
      taskId: args.taskId,
      channel: args.channel,
      subject: content.subject,
      body: content.body,
      recipient: args.recipient,
      tone: args.tone ?? "concise",
      source: args.source ?? "follow_up_agent",
      createdAt: now,
      updatedAt: now,
    }));

    if (args.taskId) {
      await ctx.db.patch(args.taskId, {
        draftId,
        state: "draft_ready",
        updatedAt: now,
      });
      await refreshNextFollowUpAt(ctx, args.applicationId);
    }
    return draftId;
  },
});

export const updateOutreachDraft = mutation({
  args: {
    draftId: v.id("outreachDrafts"),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    recipient: v.optional(v.string()),
    tone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, omitUndefined({
      subject: args.subject,
      body: args.body,
      recipient: args.recipient,
      tone: args.tone,
      updatedAt: new Date().toISOString(),
    }));
    return null;
  },
});

export const approveOutreachDraft = mutation({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, {
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const markManualSendComplete = mutation({
  args: {
    taskId: v.id("followUpTasks"),
    completedAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    const completedAt = args.completedAt ?? new Date().toISOString();
    await ctx.db.patch(args.taskId, {
      state: "sent_manually",
      completedAt,
      updatedAt: completedAt,
    });
    await ctx.db.patch(task.applicationId, {
      status: "followed_up",
      lastStatusAt: completedAt,
      updatedAt: completedAt,
    });
    await refreshNextFollowUpAt(ctx, task.applicationId);
    return null;
  },
});

export const recordResponse = mutation({
  args: {
    applicationId: v.id("applications"),
    status: v.optional(statusValidator),
    responseAt: v.optional(v.string()),
    responseSummary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = args.status ?? "responded";
    if (!isResponseStatus(status)) throw new Error("invalid_response_status");
    const responseAt = args.responseAt ?? new Date().toISOString();
    await ctx.db.patch(args.applicationId, {
      status,
      responseAt,
      responseSummary: args.responseSummary,
      lastStatusAt: responseAt,
      nextFollowUpAt: undefined,
      updatedAt: responseAt,
    });
    return null;
  },
});

async function ensureDefaultFollowUps(ctx: any, application: any) {
  const existing = await ctx.db
    .query("followUpTasks")
    .withIndex("by_application", (q: any) => q.eq("applicationId", application._id))
    .collect();
  if (existing.length > 0 || !application.appliedAt) return;

  const now = new Date().toISOString();
  for (const task of buildDefaultFollowUpTasks(application.appliedAt)) {
    await ctx.db.insert("followUpTasks", {
      demoUserId: application.demoUserId,
      applicationId: application._id,
      channel: task.channel,
      state: task.state,
      scheduledFor: task.scheduledFor,
      sequence: task.sequence,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function refreshNextFollowUpAt(ctx: any, applicationId: string) {
  const tasks = await ctx.db
    .query("followUpTasks")
    .withIndex("by_application", (q: any) => q.eq("applicationId", applicationId))
    .collect();
  const nextFollowUpAt = nextOpenFollowUpAt(tasks);
  await ctx.db.patch(applicationId, {
    nextFollowUpAt,
    updatedAt: new Date().toISOString(),
  });
}

async function tasksByState(
  ctx: any,
  demoUserId: string,
  state: FollowUpTaskState,
  limit: number
) {
  return await ctx.db
    .query("followUpTasks")
    .withIndex("by_demo_user_state_scheduled", (q: any) =>
      q.eq("demoUserId", demoUserId).eq("state", state)
    )
    .take(limit);
}

async function tasksByStateBefore(
  ctx: any,
  demoUserId: string,
  state: FollowUpTaskState,
  now: string,
  limit: number
) {
  return await ctx.db
    .query("followUpTasks")
    .withIndex("by_demo_user_state_scheduled", (q: any) =>
      q.eq("demoUserId", demoUserId).eq("state", state).lte("scheduledFor", now)
    )
    .take(limit);
}

async function enrichTasks(ctx: any, tasks: any[]) {
  return await Promise.all(
    tasks.map(async (task) => ({
      ...task,
      application: await ctx.db.get(task.applicationId),
      draft: task.draftId ? await ctx.db.get(task.draftId) : null,
    }))
  );
}

function isResponseStatus(status: ApplicationStatus) {
  return ["responded", "interview", "rejected", "offer", "closed"].includes(status);
}

function boundedLimit(value: number | undefined, fallback: number) {
  return Math.min(Math.max(value ?? fallback, 1), 500);
}

function omitUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  ) as T;
}
