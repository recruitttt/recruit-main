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

  function attachRemoteRun(
    runId: string,
    remoteRunId: string,
    remoteJobs: Array<{ slug: string; url?: string }>,
    source: ApplyRun["source"] = "recruit2-api",
  ) {
    const run = requireRun(runId);
    run.source = source;
    run.remoteRunId = remoteRunId;
    const remaining = [...remoteJobs];
    for (const job of run.jobs) {
      const urlsToMatch = [job.job.applicationUrl, job.job.url].filter(Boolean);
      const idx = remaining.findIndex((item) =>
        item.url != null && urlsToMatch.some((u) =>
          u != null && (u === item.url || normalizeUrlForMatch(u) === normalizeUrlForMatch(item.url!))
        )
      );
      const remote = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift();
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

function normalizeUrlForMatch(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

function randomId(prefix: string): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const uuid = cryptoObj?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
