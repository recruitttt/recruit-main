import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";

type FollowUpAction =
  | {
      action: "mark-applied";
      jobId?: string;
      company: string;
      title: string;
      provider?: string;
      jobUrl?: string;
      metadata?: Record<string, unknown>;
    }
  | { action: "mark-test-applied" }
  | {
      action: "transition";
      applicationId: string;
      status:
        | "draft"
        | "ready_to_apply"
        | "applied"
        | "follow_up_due"
        | "followed_up"
        | "responded"
        | "interview"
        | "rejected"
        | "offer"
        | "closed"
        | "blocked";
      responseSummary?: string;
    }
  | {
      action: "generate-draft";
      applicationId: string;
      taskId?: string;
      channel: "email" | "linkedin" | "manual";
      profile?: unknown;
      recipient?: string;
    }
  | {
      action: "update-draft";
      draftId: string;
      subject?: string;
      body?: string;
      recipient?: string;
      tone?: string;
    }
  | { action: "approve-draft"; draftId: string }
  | { action: "manual-send"; taskId: string }
  | { action: "skip"; taskId: string }
  | { action: "reschedule"; taskId: string; scheduledFor: string }
  | {
      action: "record-response";
      applicationId: string;
      status?: "responded" | "interview" | "rejected" | "offer" | "closed";
      responseSummary: string;
    };

export async function GET() {
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ summary: emptySummary() });
  }

  try {
    const summary = await client.query(api.followups.followUpSummary, {});
    return Response.json({ summary });
  } catch (err) {
    return errorResponse(err, "Convex follow-up query failed.");
  }
}

export async function POST(req: Request) {
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  let body: FollowUpAction;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  try {
    if (body.action === "mark-applied") {
      if (!body.company || !body.title) {
        return Response.json({ ok: false, reason: "missing_application_fields" }, { status: 400 });
      }
      const applicationId = await client.mutation(api.followups.upsertApplication, {
        jobId: body.jobId as never,
        company: body.company,
        title: body.title,
        provider: body.provider ?? "Ashby",
        jobUrl: body.jobUrl,
        status: "applied",
        appliedAt: new Date().toISOString(),
        metadata: body.metadata,
      });
      return Response.json({ ok: true, applicationId });
    }

    if (body.action === "mark-test-applied") {
      if (process.env.RECRUIT_E2E_FIXTURES !== "1") {
        return Response.json({ ok: false, reason: "fixtures_disabled" }, { status: 403 });
      }
      const applicationId = await client.mutation(api.followups.upsertApplication, {
        company: "Recruit E2E Fixture",
        title: "Dry-run staged application",
        provider: "Ashby",
        jobUrl: "https://jobs.ashbyhq.com/recruit-e2e/test-posting",
        status: "applied",
        appliedAt: new Date().toISOString(),
        metadata: {
          e2e: true,
          submitPolicy: "dry_run",
          submitAttempted: false,
          submitCompleted: false,
        },
      });
      return Response.json({ ok: true, applicationId });
    }

    if (body.action === "transition") {
      await client.mutation(api.followups.transitionApplicationStatus, {
        applicationId: body.applicationId as never,
        status: body.status,
        responseSummary: body.responseSummary,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "generate-draft") {
      const draftId = await client.mutation(api.followups.createOutreachDraft, {
        applicationId: body.applicationId as never,
        taskId: body.taskId as never,
        channel: body.channel,
        profile: body.profile,
        recipient: body.recipient,
      });
      return Response.json({ ok: true, draftId });
    }

    if (body.action === "update-draft") {
      await client.mutation(api.followups.updateOutreachDraft, {
        draftId: body.draftId as never,
        subject: body.subject,
        body: body.body,
        recipient: body.recipient,
        tone: body.tone,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "approve-draft") {
      await client.mutation(api.followups.approveOutreachDraft, {
        draftId: body.draftId as never,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "manual-send") {
      await client.mutation(api.followups.markManualSendComplete, {
        taskId: body.taskId as never,
        completedAt: new Date().toISOString(),
      });
      return Response.json({ ok: true });
    }

    if (body.action === "skip") {
      await client.mutation(api.followups.skipFollowUp, {
        taskId: body.taskId as never,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "reschedule") {
      await client.mutation(api.followups.rescheduleFollowUp, {
        taskId: body.taskId as never,
        scheduledFor: body.scheduledFor,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "record-response") {
      await client.mutation(api.followups.recordResponse, {
        applicationId: body.applicationId as never,
        status: body.status ?? "responded",
        responseSummary: body.responseSummary,
        responseAt: new Date().toISOString(),
      });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch (err) {
    return errorResponse(err, "Convex follow-up mutation failed.");
  }
}

function emptySummary() {
  return {
    applications: [],
    dueTasks: [],
    scheduledTasks: [],
    counts: {
      applications: 0,
      applied: 0,
      due: 0,
      responses: 0,
      interviews: 0,
      rejectedClosed: 0,
    },
  };
}

function errorResponse(err: unknown, fallback: string) {
  const error = err as Error & { cause?: { code?: string; message?: string } };
  const message = [
    error.name,
    error.message,
    error.cause?.code,
    error.cause?.message,
  ].filter(Boolean).join(": ") || fallback;
  return Response.json({ ok: false, reason: message }, { status: 500 });
}
