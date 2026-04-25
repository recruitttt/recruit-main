"use node";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { actionGeneric, anyApi } from "convex/server";
import { v } from "convex/values";

import {
  buildBackoffDelayMs,
  buildMimeMessage,
  classifyGmailError,
  detectInboundThreadReply,
} from "../lib/gmail-followups";
import { decryptOAuthToken } from "../lib/oauth-token-crypto";

const action = actionGeneric;
const internal = anyApi;
const MAX_ATTEMPTS = 5;

export const sendApprovedFollowUpWithGmail = action({
  args: { taskId: v.id("followUpTasks") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await sendTask(ctx, args.taskId);
  },
});

export const processDueGmailFollowUps = action({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const tasks = await ctx.runQuery(internal.followups.listDueApprovedGmailTasks, {
      now: new Date().toISOString(),
      limit: args.limit ?? 10,
    });
    const results = [];
    for (const task of tasks) {
      results.push(await sendTask(ctx, task._id));
    }
    return { ok: true, processed: results.length, results };
  },
});

export const syncGmailThreadResponses = action({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(internal.followups.listGmailThreadsForSync, {
      limit: args.limit ?? 25,
    });
    let inserted = 0;
    for (const row of rows) {
      try {
        const accessToken = await refreshAccessToken(row.connection.encryptedRefreshToken);
        const thread = await gmailJson(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(row.task.gmailThreadId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`,
          { method: "GET", accessToken }
        );
        const reply = detectInboundThreadReply({
          selfEmail: row.connection.accountEmail ?? "",
          sentAt: row.draft?.sentAt ?? row.task.completedAt,
          messages: thread.messages ?? [],
        });
        if (!reply) continue;
        const didInsert = await ctx.runMutation(internal.followups.recordGmailResponse, {
          applicationId: row.application._id,
          taskId: row.task._id,
          gmailMessageId: reply.gmailMessageId,
          gmailThreadId: row.task.gmailThreadId,
          from: reply.from,
          subject: reply.subject,
          snippet: reply.snippet,
          receivedAt: reply.receivedAt,
        });
        if (didInsert) inserted++;
      } catch (error) {
        const classification = classifyGmailError(error);
        if (classification.kind === "auth") {
          await ctx.runMutation(internal.followups.markGmailConnectionError, {
            status: "reconnect_required",
            lastError: classification.message ?? "Gmail reconnect required.",
          });
        }
      }
    }
    return { ok: true, checked: rows.length, inserted };
  },
});

async function sendTask(ctx: any, taskId: string) {
  const bundle = await ctx.runQuery(internal.followups.getGmailSendBundle, { taskId });
  const validation = validateBundle(bundle);
  if (!validation.ok) {
    if (shouldBlockValidationFailure(validation.reason, bundle)) {
      return await blockWithoutAttempt(ctx, taskId, validation.reason);
    }
    return { ok: false, reason: validation.reason };
  }
  if (bundle.latestAttempt?.state === "sent" || bundle.task.sendState === "sent") {
    return { ok: true, state: "already_sent" };
  }
  if ((bundle.latestAttempt?.attemptNumber ?? 0) >= MAX_ATTEMPTS) {
    return await blockWithoutAttempt(ctx, taskId, "max_attempts_reached");
  }

  const attempt = await ctx.runMutation(internal.followups.beginSendAttempt, { taskId });
  try {
    const accessToken = await refreshAccessToken(bundle.connection.encryptedRefreshToken);
    const raw = buildMimeMessage({
      from: bundle.connection.accountEmail,
      to: bundle.draft.recipient,
      subject: bundle.draft.subject,
      text: bundle.draft.body,
    });
    const draft = await gmailJson("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      accessToken,
      body: { message: { raw } },
    });
    const sent = await gmailJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draft.id)}/send`,
      { method: "POST", accessToken, body: { id: draft.id } }
    );
    await ctx.runMutation(internal.followups.markSendAttemptSent, {
      attemptId: attempt.attemptId,
      taskId,
      draftId: bundle.draft._id,
      gmailDraftId: draft.id,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      gmailHistoryId: sent.historyId ? String(sent.historyId) : undefined,
    });
    return { ok: true, state: "sent", gmailMessageId: sent.id, gmailThreadId: sent.threadId };
  } catch (error) {
    const classification = classifyGmailError(error);
    const willRetry = classification.retryable && attempt.attemptNumber < MAX_ATTEMPTS;
    const nextRetryAt = willRetry
      ? new Date(
          Date.now() +
            buildBackoffDelayMs(attempt.attemptNumber - 1, {
              retryAfterMs: classification.retryAfterMs,
            })
        ).toISOString()
      : undefined;
    const failedState =
      classification.message && /timeout/i.test(classification.message)
        ? "unknown"
        : willRetry
          ? "failed"
          : "blocked";
    await ctx.runMutation(internal.followups.markSendAttemptFailed, {
      attemptId: attempt.attemptId,
      taskId,
      state: failedState,
      errorCode: classification.kind,
      errorMessage: classification.message ?? "Gmail send failed.",
      nextRetryAt,
    });
    if (classification.kind === "auth") {
      await ctx.runMutation(internal.followups.markGmailConnectionError, {
        status: "reconnect_required",
        lastError: classification.message ?? "Gmail reconnect required.",
      });
    }
    return { ok: false, state: failedState, reason: classification.kind, nextRetryAt };
  }
}

function validateBundle(bundle: any): { ok: true } | { ok: false; reason: string } {
  if (!bundle?.task) return { ok: false, reason: "follow_up_task_not_found" };
  if (bundle.task.channel !== "email") return { ok: false, reason: "email_channel_required" };
  if (!bundle.application) return { ok: false, reason: "application_not_found" };
  if (!bundle.draft) return { ok: false, reason: "approved_draft_required" };
  if (!bundle.draft.approvedAt) return { ok: false, reason: "approved_draft_required" };
  if (!bundle.draft.recipient?.trim()) return { ok: false, reason: "missing_recipient" };
  if (!bundle.draft.subject?.trim()) return { ok: false, reason: "missing_subject" };
  if (!bundle.draft.body?.trim()) return { ok: false, reason: "missing_body" };
  if (!bundle.connection?.encryptedRefreshToken || bundle.connection.status !== "connected") {
    return { ok: false, reason: "gmail_connection_required" };
  }
  return { ok: true };
}

function shouldBlockValidationFailure(reason: string, bundle: any) {
  if (!bundle?.task || !bundle?.draft?.approvedAt) return false;
  return ["gmail_connection_required", "missing_recipient", "missing_subject", "missing_body"].includes(reason);
}

async function blockWithoutAttempt(ctx: any, taskId: string, reason: string) {
  const attempt = await ctx.runMutation(internal.followups.beginSendAttempt, { taskId });
  await ctx.runMutation(internal.followups.markSendAttemptFailed, {
    attemptId: attempt.attemptId,
    taskId,
    state: "blocked",
    errorCode: reason,
    errorMessage: reason,
  });
  return { ok: false, state: "blocked", reason };
}

async function refreshAccessToken(encryptedRefreshToken: string) {
  const refreshToken = decryptOAuthToken(encryptedRefreshToken);
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const json = await safeJson(res);
  if (!res.ok) {
    throw { status: res.status, message: json.error_description ?? json.error, errors: json.error ? [{ reason: json.error }] : undefined };
  }
  return json.access_token as string;
}

async function gmailJson(
  url: string,
  options: { method: "GET" | "POST"; accessToken: string; body?: unknown }
) {
  const res = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await safeJson(res);
  if (!res.ok) {
    throw {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      message: json.error?.message ?? json.error_description ?? json.error,
      errors: json.error?.errors,
    };
  }
  return json;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}
