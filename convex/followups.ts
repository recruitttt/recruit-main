/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
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
const internalQuery = internalQueryGeneric;
const internalMutation = internalMutationGeneric;

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

    const gmailConnection = await publicGmailConnection(ctx, demoUserId);

    return {
      applications,
      gmailConnection,
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
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("outreach_draft_not_found");
    const now = new Date().toISOString();
    await ctx.db.patch(args.draftId, {
      approvedAt: now,
      updatedAt: now,
    });
    if (draft.taskId && draft.channel === "email") {
      await ctx.db.patch(draft.taskId, {
        sendState: "approved",
        sendApprovedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const setFollowUpAutoSend = mutation({
  args: {
    taskId: v.id("followUpTasks"),
    autoSendEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    await ctx.db.patch(args.taskId, {
      autoSendEnabled: args.autoSendEnabled,
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
      sendState: task.channel === "email" ? "sent" : task.sendState,
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
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("application_not_found");
    await ctx.db.insert("applicationResponses", {
      demoUserId: application.demoUserId,
      applicationId: args.applicationId,
      channel: "manual",
      source: "manual",
      snippet: args.responseSummary,
      receivedAt: responseAt,
      createdAt: responseAt,
    });
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

export const upsertOAuthConnection = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    provider: v.literal("gmail"),
    accountEmail: v.optional(v.string()),
    scopes: v.array(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    status: v.union(
      v.literal("connected"),
      v.literal("reconnect_required"),
      v.literal("error")
    ),
    lastError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const now = new Date().toISOString();
    const existing = await gmailConnection(ctx, demoUserId);
    const patch = omitUndefined({
      demoUserId,
      provider: args.provider,
      accountEmail: args.accountEmail,
      scopes: args.scopes,
      encryptedRefreshToken: args.encryptedRefreshToken,
      status: args.status,
      lastError: args.lastError,
      connectedAt: args.status === "connected" ? now : existing?.connectedAt,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("oauthConnections", {
        ...patch,
        createdAt: now,
      });
    }
    return null;
  },
});

export const getGmailSendBundle = internalQuery({
  args: { taskId: v.id("followUpTasks") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    const [application, draft, connection, latestAttempt] = await Promise.all([
      ctx.db.get(task.applicationId),
      task.draftId ? ctx.db.get(task.draftId) : null,
      gmailConnection(ctx, task.demoUserId),
      ctx.db
        .query("sendAttempts")
        .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
        .order("desc")
        .first(),
    ]);
    return { task, application, draft, connection, latestAttempt };
  },
});

export const listDueApprovedGmailTasks = internalQuery({
  args: {
    demoUserId: v.optional(v.string()),
    now: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const limit = boundedLimit(args.limit, 25);
    const approved = await ctx.db
      .query("followUpTasks")
      .withIndex("by_demo_user_send_retry", (q: any) =>
        q.eq("demoUserId", demoUserId).eq("sendState", "approved")
      )
      .take(limit);
    const retry = await ctx.db
      .query("followUpTasks")
      .withIndex("by_demo_user_send_retry", (q: any) =>
        q.eq("demoUserId", demoUserId).eq("sendState", "retry_scheduled").lte("nextRetryAt", args.now)
      )
      .take(limit);
    return [...approved, ...retry]
      .filter((task) => task.channel === "email" && task.autoSendEnabled)
      .filter((task) => task.scheduledFor <= args.now || (task.nextRetryAt ?? "") <= args.now)
      .slice(0, limit);
  },
});

export const listGmailThreadsForSync = internalQuery({
  args: { demoUserId: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const connection = await gmailConnection(ctx, demoUserId);
    const tasks = await ctx.db
      .query("followUpTasks")
      .withIndex("by_demo_user_send_retry", (q: any) =>
        q.eq("demoUserId", demoUserId).eq("sendState", "sent")
      )
      .take(boundedLimit(args.limit, 25));
    const rows = await Promise.all(
      tasks
        .filter((task) => task.gmailThreadId)
        .map(async (task) => ({
          task,
          application: await ctx.db.get(task.applicationId),
          draft: task.draftId ? await ctx.db.get(task.draftId) : null,
          connection,
        }))
    );
    return rows.filter((row) => row.application && connection);
  },
});

export const beginSendAttempt = internalMutation({
  args: { taskId: v.id("followUpTasks") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    const existing = await ctx.db
      .query("sendAttempts")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();
    const now = new Date().toISOString();
    const attemptId = await ctx.db.insert("sendAttempts", {
      demoUserId: task.demoUserId,
      applicationId: task.applicationId,
      taskId: task._id,
      draftId: task.draftId,
      provider: "gmail",
      channel: "email",
      state: "sending",
      attemptNumber: existing.length + 1,
      scheduledFor: task.nextRetryAt ?? now,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(task._id, {
      sendState: "sending",
      lastAttemptAt: now,
      updatedAt: now,
    });
    return { attemptId, attemptNumber: existing.length + 1 };
  },
});

export const markSendAttemptSent = internalMutation({
  args: {
    attemptId: v.id("sendAttempts"),
    taskId: v.id("followUpTasks"),
    draftId: v.optional(v.id("outreachDrafts")),
    gmailDraftId: v.optional(v.string()),
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
    gmailHistoryId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("follow_up_task_not_found");
    const now = new Date().toISOString();
    await ctx.db.patch(args.attemptId, omitUndefined({
      state: "sent",
      completedAt: now,
      gmailDraftId: args.gmailDraftId,
      gmailMessageId: args.gmailMessageId,
      gmailThreadId: args.gmailThreadId,
      gmailHistoryId: args.gmailHistoryId,
      updatedAt: now,
    }));
    await ctx.db.patch(args.taskId, omitUndefined({
      state: "sent_manually",
      sendState: "sent",
      completedAt: now,
      gmailMessageId: args.gmailMessageId,
      gmailThreadId: args.gmailThreadId,
      gmailHistoryId: args.gmailHistoryId,
      updatedAt: now,
    }));
    if (args.draftId) {
      await ctx.db.patch(args.draftId, omitUndefined({
        gmailDraftId: args.gmailDraftId,
        syncedAt: now,
        sentAt: now,
        updatedAt: now,
      }));
    }
    await ctx.db.patch(task.applicationId, {
      status: "followed_up",
      lastStatusAt: now,
      updatedAt: now,
    });
    await refreshNextFollowUpAt(ctx, task.applicationId);
    return null;
  },
});

export const markSendAttemptFailed = internalMutation({
  args: {
    attemptId: v.id("sendAttempts"),
    taskId: v.id("followUpTasks"),
    state: v.union(v.literal("failed"), v.literal("blocked"), v.literal("unknown")),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    nextRetryAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const sendState =
      args.state === "unknown"
        ? "unknown"
        : args.nextRetryAt
          ? "retry_scheduled"
          : "blocked";
    await ctx.db.patch(args.attemptId, omitUndefined({
      state: args.state,
      completedAt: now,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      nextRetryAt: args.nextRetryAt,
      updatedAt: now,
    }));
    await ctx.db.patch(args.taskId, omitUndefined({
      sendState,
      nextRetryAt: args.nextRetryAt,
      updatedAt: now,
    }));
    return null;
  },
});

export const recordGmailResponse = internalMutation({
  args: {
    applicationId: v.id("applications"),
    taskId: v.optional(v.id("followUpTasks")),
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
    from: v.optional(v.string()),
    subject: v.optional(v.string()),
    snippet: v.optional(v.string()),
    receivedAt: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("application_not_found");
    if (args.gmailMessageId) {
      const existing = await ctx.db
        .query("applicationResponses")
        .withIndex("by_gmail_message", (q: any) =>
          q.eq("gmailMessageId", args.gmailMessageId)
        )
        .first();
      if (existing) return false;
    }
    const now = new Date().toISOString();
    await ctx.db.insert("applicationResponses", omitUndefined({
      demoUserId: application.demoUserId,
      applicationId: args.applicationId,
      taskId: args.taskId,
      channel: "email",
      source: "gmail_thread_sync",
      from: args.from,
      subject: args.subject,
      snippet: args.snippet,
      gmailMessageId: args.gmailMessageId,
      gmailThreadId: args.gmailThreadId,
      receivedAt: args.receivedAt,
      createdAt: now,
    }));
    await ctx.db.patch(args.applicationId, {
      status: "responded",
      responseAt: args.receivedAt,
      responseSummary: args.snippet ?? "Gmail reply detected.",
      lastStatusAt: args.receivedAt,
      nextFollowUpAt: undefined,
      updatedAt: now,
    });
    return true;
  },
});

export const markGmailConnectionError = internalMutation({
  args: {
    demoUserId: v.optional(v.string()),
    status: v.union(v.literal("reconnect_required"), v.literal("error")),
    lastError: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await gmailConnection(ctx, args.demoUserId ?? DEMO_USER_ID);
    if (connection) {
      await ctx.db.patch(connection._id, {
        status: args.status,
        lastError: args.lastError,
        updatedAt: new Date().toISOString(),
      });
    }
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
    tasks.map(async (task) => {
      const [application, draft, latestAttempt, responses] = await Promise.all([
        ctx.db.get(task.applicationId),
        task.draftId ? ctx.db.get(task.draftId) : null,
        ctx.db
          .query("sendAttempts")
          .withIndex("by_task", (q: any) => q.eq("taskId", task._id))
          .order("desc")
          .first(),
        ctx.db
          .query("applicationResponses")
          .withIndex("by_application", (q: any) =>
            q.eq("applicationId", task.applicationId)
          )
          .order("desc")
          .take(3),
      ]);
      return {
        ...task,
        application,
        draft,
        latestAttempt,
        responses,
      };
    })
  );
}

async function gmailConnection(ctx: any, demoUserId: string) {
  return await ctx.db
    .query("oauthConnections")
    .withIndex("by_demo_provider", (q: any) =>
      q.eq("demoUserId", demoUserId).eq("provider", "gmail")
    )
    .unique();
}

async function publicGmailConnection(ctx: any, demoUserId: string) {
  const connection = await gmailConnection(ctx, demoUserId);
  if (!connection) return null;
  return {
    provider: connection.provider,
    accountEmail: connection.accountEmail,
    scopes: connection.scopes,
    status: connection.status,
    lastError: connection.lastError,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
  };
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
