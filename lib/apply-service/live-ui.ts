import type { ApplyJobStatus, ApplyMode, ApplyRun } from "./types";

export type RemoteAgentStatus =
  | "queued"
  | "running"
  | "awaiting_login"
  | "awaiting_user_input"
  | "awaiting_final_approval"
  | "submitting"
  | "submitted"
  | "failed"
  | "cancelled";

export type LiveFieldStatus = "pending" | "acting" | "filled" | "skipped" | "failed";
export type LiveFieldVia = "ats_prefill" | "structured" | "computer";

export type LiveApplyField = {
  fieldId: number;
  label: string;
  selector?: string;
  role: string;
  required: boolean;
  status: LiveFieldStatus;
  value?: string;
  note?: string;
  error?: string;
  via?: LiveFieldVia;
};

export type LiveApplyTimelineItem = {
  id: string;
  stepIndex: number;
  kind: "step" | "note" | "draft";
  label: string;
  message: string;
};

export type LiveApplyJob = {
  id: string;
  remoteSlug?: string;
  remoteRunId?: string;
  company: string;
  title: string;
  url: string;
  mode: ApplyMode;
  status: RemoteAgentStatus | ApplyJobStatus;
  pageUrl?: string;
  pageTitle?: string;
  screenshotPng?: string;
  annotatedScreenshotPng?: string;
  fieldCount?: number;
  fields: LiveApplyField[];
  timeline: LiveApplyTimelineItem[];
  liveViewUrl?: string;
  attention?: string;
  error?: string;
};

export type LiveApplyEvent = { runId?: string } & (
  | { kind: "status"; jobSlug: string; status: RemoteAgentStatus }
  | { kind: "step"; jobSlug: string; stepIndex: number; action: Record<string, unknown> & { kind?: string } }
  | { kind: "thought"; jobSlug: string; stepIndex: number; text: string }
  | { kind: "agent_note"; jobSlug: string; stepIndex: number; message: string }
  | { kind: "draft"; jobSlug: string; entry: { stepIndex: number; fieldLabel?: string; value?: string; kind?: string } }
  | { kind: "screenshot"; jobSlug: string; pngBase64: string }
  | { kind: "snapshot_taken"; jobSlug: string; fieldCount: number; url: string; title: string; annotatedScreenshotPng?: string }
  | {
      kind: "field_set";
      jobSlug: string;
      fieldId: number;
      label: string;
      selector?: string;
      role: string;
      required: boolean;
    }
  | { kind: "field_filled"; jobSlug: string; fieldId: number; label: string; value: string; note?: string; via: LiveFieldVia }
  | { kind: "field_skipped"; jobSlug: string; fieldId: number; label: string; reason: string }
  | { kind: "field_failed"; jobSlug: string; fieldId: number; label: string; error: string }
  | { kind: "awaiting_final_approval"; jobSlug: string; screenshotPng?: string; snapshot?: unknown[] }
  | { kind: "login_required"; jobSlug: string; reason: string; currentUrl?: string; liveViewUrl?: string; fullscreenUrl?: string; screenshotPng?: string }
  | { kind: "verification_required"; jobSlug: string; reason: string; currentUrl?: string; liveViewUrl?: string; fullscreenUrl?: string; screenshotPng?: string }
  | { kind: "site_blocked"; jobSlug: string; reason: string; currentUrl?: string; liveViewUrl?: string; fullscreenUrl?: string; screenshotPng?: string }
  | { kind: "manual_finish_required"; jobSlug: string; reason: string; currentUrl?: string; liveViewUrl?: string; fullscreenUrl?: string; screenshotPng?: string }
  | { kind: "missing_required_answer"; jobSlug: string; question: string; fieldLabel?: string; screenshotPng?: string }
  | { kind: "surface_snapshot"; jobSlug: string; url: string; title?: string; fieldCount: number; notes?: string }
  | { kind: "ats_detected"; jobSlug: string; adapter: string }
  | { kind: "phase_transition"; jobSlug: string; phase: string; atMs: number }
);

export type ApplyHubMetrics = {
  total: number;
  active: number;
  needsReview: number;
  submitted: number;
  failed: number;
  fieldsFilled: number;
  fieldsTotal: number;
};

export function seedLiveApplyJobs(run: ApplyRun): LiveApplyJob[] {
  return run.jobs.map((job) => ({
    id: job.id,
    ...(job.remoteJobSlug ? { remoteSlug: job.remoteJobSlug } : {}),
    ...(job.remoteRunId ? { remoteRunId: job.remoteRunId } : {}),
    company: job.job.company,
    title: job.job.title,
    url: job.job.applicationUrl ?? job.job.url,
    mode: run.settings.mode,
    status: job.status,
    ...(job.screenshotPng ? { screenshotPng: job.screenshotPng } : {}),
    fields: [],
    timeline: [],
    ...(job.liveViewUrl ? { liveViewUrl: job.liveViewUrl } : {}),
    ...(job.error ? { error: job.error } : {}),
  }));
}

export function mergeRunJobState(current: readonly LiveApplyJob[], run: ApplyRun): LiveApplyJob[] {
  const byId = new Map(current.map((job) => [job.id, job]));
  return run.jobs.map((job) => {
    const existing = byId.get(job.id);
    if (!existing) return seedLiveApplyJobs({ ...run, jobs: [job] })[0]!;
    return {
      ...existing,
      status: preferTerminalStatus(job.status, existing.status),
      ...(job.remoteJobSlug ? { remoteSlug: job.remoteJobSlug } : {}),
      ...(job.remoteRunId ? { remoteRunId: job.remoteRunId } : {}),
      ...(job.screenshotPng && !existing.screenshotPng ? { screenshotPng: job.screenshotPng } : {}),
      ...(job.liveViewUrl ? { liveViewUrl: job.liveViewUrl } : {}),
      ...(job.error ? { error: job.error } : {}),
    };
  });
}

export function reduceLiveApplyEvent(current: readonly LiveApplyJob[], event: LiveApplyEvent): LiveApplyJob[] {
  if (!("jobSlug" in event) || typeof event.jobSlug !== "string") return [...current];
  return current.map((job) => {
    if (job.remoteSlug !== event.jobSlug && job.id !== event.jobSlug) return job;
    return reduceJob(job, event);
  });
}

export function fieldProgress(job: LiveApplyJob): { total: number; filled: number; failed: number; pending: number } {
  const total = job.fieldCount ?? job.fields.length;
  const filled = job.fields.filter((field) => field.status === "filled").length;
  const failed = job.fields.filter((field) => field.status === "failed").length;
  const pending = Math.max(0, total - filled - failed);
  return { total, filled, failed, pending };
}

export function applyHubMetrics(jobs: readonly LiveApplyJob[]): ApplyHubMetrics {
  return jobs.reduce<ApplyHubMetrics>(
    (acc, job) => {
      const progress = fieldProgress(job);
      return {
        total: acc.total + 1,
        active: acc.active + (isActive(job.status) ? 1 : 0),
        needsReview: acc.needsReview + (needsReview(job.status) ? 1 : 0),
        submitted: acc.submitted + (job.status === "submitted" || job.status === "submitted_dev" ? 1 : 0),
        failed: acc.failed + (job.status === "failed" ? 1 : 0),
        fieldsFilled: acc.fieldsFilled + progress.filled,
        fieldsTotal: acc.fieldsTotal + progress.total,
      };
    },
    { total: 0, active: 0, needsReview: 0, submitted: 0, failed: 0, fieldsFilled: 0, fieldsTotal: 0 },
  );
}

export function statusLabel(status: LiveApplyJob["status"]): string {
  const labels: Record<string, string> = {
    queued: "Queued",
    tailoring: "Tailoring",
    filling: "Filling",
    running: "Filling",
    questions_ready: "Questions",
    review_ready: "Review",
    awaiting_login: "Login",
    awaiting_user_input: "Needs you",
    awaiting_final_approval: "Approval",
    submit_queued: "Submit queued",
    submitting: "Submitting",
    submitted_dev: "Submitted",
    submitted: "Submitted",
    manual_finish_required: "Manual finish",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? String(status).replace(/_/g, " ");
}

function reduceJob(job: LiveApplyJob, event: LiveApplyEvent): LiveApplyJob {
  switch (event.kind) {
    case "status":
      return { ...job, status: event.status };
    case "step":
      return {
        ...job,
        timeline: upsertTimeline(job.timeline, {
          id: `step-${event.stepIndex}`,
          stepIndex: event.stepIndex,
          kind: "step",
          label: String(event.action.kind ?? "action"),
          message: summarizeAction(event.action),
        }),
      };
    case "thought":
      return {
        ...job,
        timeline: upsertTimeline(job.timeline, {
          id: `thought-${event.stepIndex}`,
          stepIndex: event.stepIndex,
          kind: "note",
          label: "AI rationale",
          message: event.text,
        }),
      };
    case "agent_note":
      return {
        ...job,
        timeline: upsertTimeline(job.timeline, {
          id: `note-${event.stepIndex}`,
          stepIndex: event.stepIndex,
          kind: "note",
          label: "AI note",
          message: event.message,
        }),
        ...(isFailure(event.message) ? { error: event.message } : {}),
      };
    case "draft":
      return {
        ...job,
        timeline: upsertTimeline(job.timeline, {
          id: `draft-${event.entry.stepIndex}`,
          stepIndex: event.entry.stepIndex,
          kind: "draft",
          label: event.entry.fieldLabel ?? String(event.entry.kind ?? "draft"),
          message: event.entry.value ?? "Draft captured",
        }),
      };
    case "screenshot":
      return { ...job, screenshotPng: event.pngBase64 };
    case "snapshot_taken":
      return {
        ...job,
        pageUrl: event.url,
        pageTitle: event.title,
        fieldCount: event.fieldCount,
        ...(event.annotatedScreenshotPng
          ? { annotatedScreenshotPng: event.annotatedScreenshotPng, screenshotPng: event.annotatedScreenshotPng }
          : {}),
      };
    case "surface_snapshot":
      return {
        ...job,
        pageUrl: event.url,
        ...(event.title ? { pageTitle: event.title } : {}),
        fieldCount: event.fieldCount,
        ...(event.notes ? { attention: event.notes } : {}),
      };
    case "field_set":
      return {
        ...job,
        fields: upsertField(job.fields, {
          fieldId: event.fieldId,
          label: event.label,
          ...(event.selector ? { selector: event.selector } : {}),
          role: event.role,
          required: event.required,
          status: "pending",
        }),
      };
    case "field_filled":
      return {
        ...job,
        fields: patchField(job.fields, event.fieldId, {
          label: event.label,
          status: "filled",
          value: event.value,
          via: event.via,
          ...(event.note ? { note: event.note } : {}),
        }),
      };
    case "field_skipped":
      return {
        ...job,
        fields: patchField(job.fields, event.fieldId, {
          label: event.label,
          status: "skipped",
          note: event.reason,
        }),
      };
    case "field_failed":
      return {
        ...job,
        error: `${event.label}: ${event.error}`,
        fields: patchField(job.fields, event.fieldId, {
          label: event.label,
          status: "failed",
          error: event.error,
        }),
      };
    case "awaiting_final_approval":
      return {
        ...job,
        status: "awaiting_final_approval",
        attention: `${event.snapshot?.length ?? 0} draft fields ready for review`,
        ...(event.screenshotPng ? { screenshotPng: event.screenshotPng } : {}),
      };
    case "login_required":
    case "verification_required":
    case "site_blocked":
    case "manual_finish_required":
      return {
        ...job,
        status: event.kind === "login_required" ? "awaiting_login" : "awaiting_user_input",
        attention: event.reason,
        ...(event.currentUrl ? { pageUrl: event.currentUrl } : {}),
        ...(event.liveViewUrl ?? event.fullscreenUrl ? { liveViewUrl: event.liveViewUrl ?? event.fullscreenUrl } : {}),
        ...(event.screenshotPng ? { screenshotPng: event.screenshotPng } : {}),
      };
    case "missing_required_answer":
      return {
        ...job,
        status: "awaiting_user_input",
        attention: event.fieldLabel ? `${event.fieldLabel}: ${event.question}` : event.question,
        ...(event.screenshotPng ? { screenshotPng: event.screenshotPng } : {}),
      };
    default:
      return job;
  }
}

function preferTerminalStatus(local: ApplyJobStatus, remote: LiveApplyJob["status"]): LiveApplyJob["status"] {
  if (local === "submitted_dev" || local === "submitted" || local === "cancelled" || local === "failed") return local;
  return remote;
}

function isActive(status: LiveApplyJob["status"]): boolean {
  return status === "filling" || status === "running" || status === "tailoring" || status === "submitting";
}

function needsReview(status: LiveApplyJob["status"]): boolean {
  return status === "questions_ready" || status === "review_ready" || status === "awaiting_user_input" || status === "awaiting_final_approval" || status === "awaiting_login" || status === "manual_finish_required";
}

function upsertTimeline(rows: readonly LiveApplyTimelineItem[], incoming: LiveApplyTimelineItem): LiveApplyTimelineItem[] {
  return [...rows.filter((row) => row.id !== incoming.id), incoming].sort((a, b) => a.stepIndex - b.stepIndex);
}

function upsertField(rows: readonly LiveApplyField[], incoming: LiveApplyField): LiveApplyField[] {
  const existing = rows.find((row) => row.fieldId === incoming.fieldId);
  const next = existing
    ? {
        ...existing,
        ...incoming,
        status: existing.status === "pending" ? incoming.status : existing.status,
        ...(existing.value ? { value: existing.value } : {}),
        ...(existing.error ? { error: existing.error } : {}),
        ...(existing.note ? { note: existing.note } : {}),
        ...(existing.via ? { via: existing.via } : {}),
      }
    : incoming;
  return [...rows.filter((row) => row.fieldId !== incoming.fieldId), next].sort((a, b) => a.fieldId - b.fieldId);
}

function patchField(rows: readonly LiveApplyField[], fieldId: number, patch: Partial<LiveApplyField>): LiveApplyField[] {
  const existing = rows.find((row) => row.fieldId === fieldId) ?? {
    fieldId,
    label: "",
    role: "unknown",
    required: false,
    status: "pending" as LiveFieldStatus,
  };
  return upsertField(rows, { ...existing, ...patch, fieldId });
}

function summarizeAction(action: Record<string, unknown> & { kind?: string }): string {
  if (action.kind === "set_field" && typeof action.fieldId === "number") return `Field #${action.fieldId}`;
  if (action.kind === "select_option" && typeof action.fieldId === "number") return `Option for #${action.fieldId}`;
  if (action.kind === "upload_file" && typeof action.fieldId === "number") return `Upload for #${action.fieldId}`;
  if (typeof action.value === "string") return action.value;
  if (typeof action.text === "string") return action.text;
  if (typeof action.reason === "string") return action.reason;
  return action.kind ? String(action.kind) : "Action recorded";
}

function isFailure(message: string): boolean {
  return /^Run failed(?:\s+\[[^\]]+\])?:/i.test(message);
}
