import { groupDeferredQuestions } from "./deferred-questions";
import type {
  ApplicationReviewItem,
  ApplyEvent,
  ApplyJob,
  ApplyRun,
  DeferredQuestion,
  DeferredQuestionGroup,
  NormalizedApplyBatch,
} from "./types";

export type ApplyRunStoreOptions = {
  now?: () => number;
  id?: () => string;
};

export type ApplyRunStore = ReturnType<typeof createApplyRunStore>;

export function createApplyRunStore(options: ApplyRunStoreOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const id = options.id ?? (() => randomId("run"));
  const runs = new Map<string, ApplyRun>();
  const pendingQuestions = new Map<string, DeferredQuestion[]>();

  function createRun(batch: NormalizedApplyBatch, meta: { source: ApplyRun["source"]; remoteRunId?: string }): ApplyRun {
    const runId = id();
    const timestamp = iso(now());
    const jobs: ApplyJob[] = batch.jobs.map((job) => ({
      id: job.id,
      job,
      status: "filling",
      tailoredResume: batch.tailoredResumes[job.id],
      reviewItems: [
        {
          id: `${job.id}:final-submit`,
          jobId: job.id,
          label: "Final submission",
          value: batch.settings.devSkipRealSubmit
            ? "Development mode will mark this submitted without clicking the live submit button."
            : "Production submit requires explicit approval.",
          kind: "final_submit",
        },
      ],
      remoteRunId: meta.remoteRunId,
      updatedAt: timestamp,
    }));
    const run: ApplyRun = {
      id: runId,
      status: "filling",
      source: meta.source,
      jobs,
      settings: batch.settings,
      questionGroups: [],
      events: [],
      remoteRunId: meta.remoteRunId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    runs.set(runId, run);
    emit(runId, "run_created", "Application batch created.", { jobCount: jobs.length, source: meta.source });
    for (const job of jobs) {
      emit(runId, "job_started", `Started filling ${job.job.company} / ${job.job.title}.`, {
        jobId: job.id,
        resume: job.tailoredResume
          ? {
              filename: job.tailoredResume.filename,
              byteLength: job.tailoredResume.byteLength,
            }
          : null,
      }, job.id);
    }
    return cloneRun(run);
  }

  function getRun(runId: string): ApplyRun | null {
    const run = runs.get(runId);
    return run ? cloneRun(run) : null;
  }

  function listEvents(runId: string): ApplyEvent[] {
    return runs.get(runId)?.events.map(clone) ?? [];
  }

  function advanceLocalRun(runId: string): ApplyRun | null {
    const run = runs.get(runId);
    if (!run) return null;
    if (run.source !== "mock" || run.remoteRunId) return cloneRun(run);

    const startedAt = Date.parse(run.createdAt);
    const elapsedMs = Number.isFinite(startedAt) ? Math.max(0, now() - startedAt) : 0;
    for (const [index, job] of run.jobs.entries()) {
      advanceLocalJob(run, job, Math.max(0, elapsedMs - index * 350));
    }
    if (run.jobs.every((job) => job.status === "review_ready" || job.status === "submitted_dev" || job.status === "cancelled")) {
      run.status = run.jobs.some((job) => job.status === "submitted_dev") ? run.status : "review_ready";
    }
    touch(run, now());
    return cloneRun(run);
  }

  function recordDeferredQuestion(runId: string, question: DeferredQuestion): DeferredQuestionGroup[] {
    const run = requireRun(runId);
    const existing = pendingQuestions.get(runId) ?? [];
    existing.push(question);
    pendingQuestions.set(runId, existing);
    run.questionGroups = groupDeferredQuestions(existing);
    run.status = "questions_ready";
    patchJob(run, question.jobId, {
      status: "questions_ready",
    });
    emit(runId, "deferred_question_recorded", question.prompt, question, question.jobId);
    emit(runId, "batch_questions_ready", "Questions to confirm are ready.", {
      groupCount: run.questionGroups.length,
    });
    touch(run, now());
    return clone(run.questionGroups);
  }

  function getQuestionGroups(runId: string): DeferredQuestionGroup[] {
    return clone(runs.get(runId)?.questionGroups ?? []);
  }

  function resolveQuestionBatch(
    runId: string,
    answers: Record<string, { answer: string; remember?: boolean; overrides?: Record<string, string> }>,
  ): DeferredQuestionGroup[] {
    const run = requireRun(runId);
    run.questionGroups = run.questionGroups.map((group) => {
      const answer = answers[group.id] ?? answers[group.semanticKey];
      if (!answer) return group;
      return {
        ...group,
        status: "resolved",
        answer: answer.answer,
        remember: answer.remember === true,
      };
    });
    for (const job of run.jobs) {
      if (job.status === "questions_ready") {
        job.status = "review_ready";
        job.updatedAt = iso(now());
      }
    }
    run.status = run.questionGroups.some((group) => group.status === "pending")
      ? "questions_ready"
      : "review_ready";
    emit(runId, "batch_questions_resolved", "Confirmed answers were applied back to affected forms.", {
      resolvedGroups: Object.keys(answers),
    });
    touch(run, now());
    return clone(run.questionGroups);
  }

  function addReviewItems(runId: string, jobId: string, items: ApplicationReviewItem[]): ApplyJob | null {
    const run = requireRun(runId);
    const job = run.jobs.find((item) => item.id === jobId);
    if (!job) return null;
    job.reviewItems = mergeReviewItems(job.reviewItems, items);
    job.status = "review_ready";
    job.updatedAt = iso(now());
    run.status = run.questionGroups.some((group) => group.status === "pending")
      ? "questions_ready"
      : "review_ready";
    emit(runId, "review_ready", `Review ready for ${job.job.company}.`, { itemCount: job.reviewItems.length }, jobId);
    touch(run, now());
    return clone(job);
  }

  function approveJob(runId: string, jobId: string, options: { devSkipRealSubmit?: boolean } = {}): ApplyJob | null {
    const run = requireRun(runId);
    const job = run.jobs.find((item) => item.id === jobId);
    if (!job) return null;
    job.status = options.devSkipRealSubmit ?? run.settings.devSkipRealSubmit ? "submitted_dev" : "submit_queued";
    job.updatedAt = iso(now());
    emit(
      runId,
      "submit_approved",
      job.status === "submitted_dev"
        ? `Marked ${job.job.company} as submitted in development mode.`
        : `Queued final submit for ${job.job.company}.`,
      { devSkipRealSubmit: job.status === "submitted_dev" },
      jobId,
    );
    updateRunTerminalStatus(run);
    touch(run, now());
    return clone(job);
  }

  function cancelJob(runId: string, jobId: string): ApplyJob | null {
    const run = requireRun(runId);
    const job = run.jobs.find((item) => item.id === jobId);
    if (!job) return null;
    job.status = "cancelled";
    job.updatedAt = iso(now());
    emit(runId, "job_cancelled", `Cancelled ${job.job.company} / ${job.job.title}.`, {}, jobId);
    updateRunTerminalStatus(run);
    touch(run, now());
    return clone(job);
  }

  function attachRemoteRun(runId: string, remoteRunId: string, remoteJobs: Array<{ slug: string; url?: string }>) {
    const run = requireRun(runId);
    run.source = "recruit2-api";
    run.remoteRunId = remoteRunId;
    for (const job of run.jobs) {
      const remote = remoteJobs.find((item) => item.url === job.job.applicationUrl || item.url === job.job.url) ?? remoteJobs.shift();
      if (remote) {
        job.remoteRunId = remoteRunId;
        job.remoteJobSlug = remote.slug;
      }
    }
    emit(runId, "recruit2_run_started", "Recruit2 application engine accepted the batch.", {
      remoteRunId,
      remoteJobCount: remoteJobs.length,
    });
    touch(run, now());
  }

  return {
    createRun,
    getRun,
    listEvents,
    advanceLocalRun,
    recordDeferredQuestion,
    getQuestionGroups,
    resolveQuestionBatch,
    addReviewItems,
    approveJob,
    cancelJob,
    attachRemoteRun,
  };

  function emit(runId: string, kind: ApplyEvent["kind"], message: string, payload?: unknown, jobId?: string): void {
    const run = runs.get(runId);
    if (!run) return;
    run.events.push({
      id: randomId("evt"),
      runId,
      jobId,
      kind,
      message,
      createdAt: iso(now()),
      payload,
    });
    touch(run, now());
  }

  function requireRun(runId: string): ApplyRun {
    const run = runs.get(runId);
    if (!run) throw new Error("run_not_found");
    return run;
  }

  function advanceLocalJob(run: ApplyRun, job: ApplyJob, elapsedMs: number): void {
    const fields = localFieldPlan(run, job);
    const screenshot = localScreenshot(job, fields, Math.min(fields.length, elapsedMs >= 1_800 ? fields.length : elapsedMs >= 900 ? 3 : 0));

    if (!hasLocalStage(run, job.id, "snapshot")) {
      job.screenshotPng = screenshot;
      emitLocalLiveEvent(run, job.id, "snapshot", "Captured live form screenshot.", {
        kind: "snapshot_taken",
        jobSlug: job.id,
        fieldCount: fields.length,
        url: job.job.applicationUrl ?? job.job.url,
        title: `${job.job.company} application`,
        annotatedScreenshotPng: screenshot,
      });
      fields.forEach((field) => {
        emitLocalLiveEvent(run, job.id, `field-${field.fieldId}-set`, `Detected ${field.label}.`, {
          kind: "field_set",
          jobSlug: job.id,
          fieldId: field.fieldId,
          label: field.label,
          selector: field.selector,
          role: field.role,
          required: field.required,
        });
      });
      emitLocalLiveEvent(run, job.id, "note-start", `AI is inspecting ${job.job.company}'s application form.`, {
        kind: "agent_note",
        jobSlug: job.id,
        stepIndex: 1,
        message: "Started from the selected job URL, captured the form, and identified required fields from the live page.",
      });
    }

    if (elapsedMs >= 900) {
      for (const field of fields.slice(0, 3)) {
        if (hasLocalStage(run, job.id, `field-${field.fieldId}-filled`)) continue;
        emitLocalLiveEvent(run, job.id, `field-${field.fieldId}-filled`, `Filled ${field.label}.`, {
          kind: "field_filled",
          jobSlug: job.id,
          fieldId: field.fieldId,
          label: field.label,
          value: field.value,
          note: field.note,
          via: "computer",
        });
      }
      job.screenshotPng = localScreenshot(job, fields, 3);
    }

    if (elapsedMs >= 1_800) {
      for (const field of fields.slice(3)) {
        if (hasLocalStage(run, job.id, `field-${field.fieldId}-filled`)) continue;
        emitLocalLiveEvent(run, job.id, `field-${field.fieldId}-filled`, `Filled ${field.label}.`, {
          kind: "field_filled",
          jobSlug: job.id,
          fieldId: field.fieldId,
          label: field.label,
          value: field.value,
          note: field.note,
          via: "computer",
        });
      }
      job.screenshotPng = localScreenshot(job, fields, fields.length);
      emitLocalLiveEvent(run, job.id, "note-review", "AI prepared the final review packet.", {
        kind: "agent_note",
        jobSlug: job.id,
        stepIndex: 2,
        message: "Profile-backed facts and the selected resume are staged. Final submit remains gated in development mode.",
      });
    }

    if (elapsedMs >= 2_500 && job.status === "filling") {
      job.status = "review_ready";
      job.updatedAt = iso(now());
      emitLocalLiveEvent(run, job.id, "final-approval", `Review ready for ${job.job.company}.`, {
        kind: "awaiting_final_approval",
        jobSlug: job.id,
        screenshotPng: job.screenshotPng,
        snapshot: fields.map((field) => ({ label: field.label, value: field.value })),
      });
      emit(run.id, "review_ready", `Review ready for ${job.job.company}.`, { itemCount: job.reviewItems.length }, job.id);
    }
  }

  function emitLocalLiveEvent(
    run: ApplyRun,
    jobId: string,
    localStage: string,
    message: string,
    liveEvent: Record<string, unknown>,
  ): void {
    if (hasLocalStage(run, jobId, localStage)) return;
    emit(run.id, "field_progress", message, { ...liveEvent, localStage }, jobId);
  }

  function hasLocalStage(run: ApplyRun, jobId: string, localStage: string): boolean {
    return run.events.some((event) => event.jobId === jobId && isRecord(event.payload) && event.payload.localStage === localStage);
  }
}

type LocalField = {
  fieldId: number;
  label: string;
  selector: string;
  role: string;
  required: boolean;
  value: string;
  note: string;
};

function localFieldPlan(run: ApplyRun, job: ApplyJob): LocalField[] {
  return [
    {
      fieldId: 1,
      label: "Name",
      selector: "#candidate-name",
      role: "textbox",
      required: true,
      value: "Profile name",
      note: "Profile-backed identity field.",
    },
    {
      fieldId: 2,
      label: "Email",
      selector: "#candidate-email",
      role: "textbox",
      required: true,
      value: "Profile email",
      note: "Profile-backed contact field.",
    },
    {
      fieldId: 3,
      label: "Resume",
      selector: "#resume-upload",
      role: "file",
      required: true,
      value: job.tailoredResume?.filename ?? "Selected resume",
      note: "Resume file staged for upload.",
    },
    {
      fieldId: 4,
      label: "Application URL",
      selector: "#application-url",
      role: "link",
      required: false,
      value: job.job.applicationUrl ?? job.job.url,
      note: "Loaded from selected job record.",
    },
    {
      fieldId: 5,
      label: "Work authorization",
      selector: "#work-authorization",
      role: "radio",
      required: true,
      value: "Authorized to work; no sponsorship needed",
      note: "Profile-backed work authorization.",
    },
    {
      fieldId: 6,
      label: "Final submission",
      selector: "#submit-application",
      role: "button",
      required: true,
      value: run.settings.devSkipRealSubmit ? "Held for development approval" : "Held for final consent",
      note: "Submit remains gated.",
    },
  ];
}

function localScreenshot(job: ApplyJob, fields: LocalField[], filledCount: number): string {
  const rows = fields.map((field, index) => {
    const filled = index < filledCount;
    const y = 220 + index * 72;
    const value = escapeXml(filled ? field.value : "");
    const border = filled ? "#4f46e5" : "#cbd5e1";
    const fill = filled ? "#eef2ff" : "#ffffff";
    return [
      `<text x="150" y="${y - 12}" font-family="Inter, Arial" font-size="18" font-weight="700" fill="#334155">${escapeXml(field.label)}${field.required ? " *" : ""}</text>`,
      `<rect x="150" y="${y}" width="900" height="44" rx="8" fill="${fill}" stroke="${border}" stroke-width="2"/>`,
      `<text x="170" y="${y + 29}" font-family="Inter, Arial" font-size="16" fill="#475569">${value || "Waiting for AI action..."}</text>`,
    ].join("");
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">
<rect width="1200" height="820" fill="#f8fafc"/>
<rect x="96" y="64" width="1008" height="692" rx="18" fill="#ffffff" stroke="#e2e8f0"/>
<text x="150" y="130" font-family="Inter, Arial" font-size="34" font-weight="800" fill="#0f172a">${escapeXml(job.job.company)}</text>
<text x="150" y="166" font-family="Inter, Arial" font-size="22" fill="#475569">${escapeXml(job.job.title)}</text>
<rect x="150" y="188" width="160" height="8" rx="4" fill="#4f46e5"/>
${rows}
<text x="150" y="730" font-family="Inter, Arial" font-size="14" fill="#64748b">Server-rendered live application preview from Recruit Main.</text>
</svg>`;
  return encodeBase64(svg);
}

function encodeBase64(value: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(value)));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function patchJob(run: ApplyRun, jobId: string, patch: Partial<ApplyJob>): void {
  const job = run.jobs.find((item) => item.id === jobId);
  if (!job) return;
  Object.assign(job, patch);
  job.updatedAt = new Date().toISOString();
}

function updateRunTerminalStatus(run: ApplyRun): void {
  if (run.jobs.every((job) => job.status === "submitted_dev" || job.status === "submitted" || job.status === "cancelled")) {
    run.status = "completed";
  } else if (run.jobs.some((job) => job.status === "submit_queued")) {
    run.status = "submitting";
  }
}

function mergeReviewItems(existing: ApplicationReviewItem[], incoming: ApplicationReviewItem[]): ApplicationReviewItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}

function touch(run: ApplyRun, time: number): void {
  run.updatedAt = iso(time);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function cloneRun(run: ApplyRun): ApplyRun {
  return clone(run);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function randomId(prefix: string): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const uuid = cryptoObj?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
