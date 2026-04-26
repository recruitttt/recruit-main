import { runAshbyFormFillOnPage, type AshbyPageLike } from "../ashby-fill/browser";
import type { AshbyApprovedAnswer, AshbyPromptAlias } from "../ashby-fill/types";
import { ashbyResultToSubmissionResult, ashbySnapshotToFormIR, detectProviderFromUrl } from "./ashby-adapter";
import { runLeverFormFillOnPage } from "../lever-fill/browser";
import { leverResultToSubmissionResult, leverSnapshotToFormIR } from "./lever-adapter";
import { isBrowserbaseCaptchaSolvingEnabled } from "../pdf";
import { findBrainstormedAnswer } from "./brainstorm-matcher";
import type {
  ApplicationJobInput,
  EvidenceBundle,
  FormIR,
  LlmMode,
  SubmissionResult,
} from "./types";

export type RunFormAutomationArgs = {
  page: AshbyPageLike;
  job: ApplicationJobInput;
  profile: unknown;
  aliases?: AshbyPromptAlias[];
  approvedAnswers?: AshbyApprovedAnswer[];
  openAiApiKey?: string | null;
  openAiModel?: string;
  llmMode?: LlmMode;
};

export type RunFormAutomationResult = {
  provider: string;
  formIR: FormIR;
  submission: SubmissionResult;
  evidence: EvidenceBundle;
  rawResult: unknown;
};

/**
 * Resolve a brainstormed answer for a given question text from the job input.
 * Returns the brainstormed answer string if a matcher hit is found, else null.
 *
 * Intended insertion point for downstream answer-resolution / LLM-draft callers:
 *   const brainstormed = resolveBrainstormedAnswer(questionText, jobInput);
 *   if (brainstormed) return brainstormed;
 *   // ... fallback to LLM resolution
 */
export function resolveBrainstormedAnswer(
  questionText: string,
  jobInput: ApplicationJobInput,
): string | null {
  return findBrainstormedAnswer(questionText, jobInput.brainstormedAnswers);
}

export async function runFormAutomation(args: RunFormAutomationArgs): Promise<RunFormAutomationResult> {
  const provider = args.job.provider ?? args.job.providerHint ?? detectProviderFromUrl(args.job.targetUrl);
  if (provider === "lever") {
    const llmMode = args.llmMode ?? args.job.llmMode;
    const rawResult = await runLeverFormFillOnPage(args.page, {
      targetUrl: args.job.targetUrl,
      profile: args.profile,
      aliases: args.aliases ?? [],
      approvedAnswers: args.approvedAnswers ?? [],
      openAiBestEffort: llmMode === "best_effort",
      openAiApiKey: llmMode === "best_effort" ? args.openAiApiKey : null,
      openAiModel: args.openAiModel,
      draftAnswerMode: llmMode === "best_effort" ? "fill" : "review_only",
      browserbaseCaptchaSolving: isBrowserbaseCaptchaSolvingEnabled(),
      submit: args.job.submitPolicy === "submit",
    });
    const formIR = leverSnapshotToFormIR({
      snapshot: rawResult.finalSnapshot,
      targetUrl: rawResult.targetUrl,
      companySlug: rawResult.companySlug,
      postingId: rawResult.postingId,
    });
    const submission = leverResultToSubmissionResult(rawResult);

    return {
      provider,
      formIR,
      submission,
      evidence: submission.evidence,
      rawResult,
    };
  }

  if (provider !== "ashby") {
    return genericFormFill(args, provider);
  }

  const llmMode = args.llmMode ?? args.job.llmMode;
  const rawResult = await runAshbyFormFillOnPage(args.page, {
    targetUrl: args.job.targetUrl,
    profile: args.profile,
    aliases: args.aliases ?? [],
    approvedAnswers: args.approvedAnswers ?? [],
    openAiBestEffort: llmMode === "best_effort",
    openAiApiKey: llmMode === "best_effort" ? args.openAiApiKey : null,
    openAiModel: args.openAiModel,
    draftAnswerMode: llmMode === "best_effort" ? "fill" : "review_only",
    submit: args.job.submitPolicy === "submit",
  });
  const formIR = ashbySnapshotToFormIR({
    snapshot: rawResult.finalSnapshot,
    targetUrl: rawResult.targetUrl,
    organizationSlug: rawResult.organizationSlug,
  });
  const submission = ashbyResultToSubmissionResult(rawResult);

  return {
    provider,
    formIR,
    submission,
    evidence: submission.evidence,
    rawResult,
  };
}

async function genericFormFill(args: RunFormAutomationArgs, provider: string): Promise<RunFormAutomationResult> {
  const page = args.page;
  const targetUrl = args.job.targetUrl;
  const notes: string[] = [];

  try {
    await page.setViewport?.({ width: 1365, height: 900 });
  } catch {
    // viewport may not be available
  }
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 45_000 });
  } catch (error) {
    notes.push(`goto_networkidle_failed=${error instanceof Error ? error.message : String(error)}`);
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    } catch {
      notes.push("goto_domcontentloaded_also_failed");
    }
  }

  const currentUrl = page.url?.() ?? targetUrl;
  const title = await page.evaluate((_: null) => document.title || "", null).catch(() => "");
  notes.push(`navigated_to=${currentUrl}`);
  if (title) notes.push(`page_title=${title}`);

  const formIR: FormIR = {
    provider: "generic",
    targetUrl,
    finalUrl: currentUrl,
    questions: [],
    controls: [],
    networkHints: [],
    evidence: notes,
  };
  const submission: SubmissionResult = {
    status: "needs_human_review",
    provider: "generic",
    confidence: 0,
    submitAttempted: false,
    submitCompleted: false,
    evidence: {
      finalUrl: currentUrl,
      notes,
    },
  };

  return {
    provider,
    formIR,
    submission,
    evidence: submission.evidence,
    rawResult: { targetUrl, finalUrl: currentUrl, notes, screenshots: [] },
  };
}

function unsupportedProviderResult(job: ApplicationJobInput, provider: string): RunFormAutomationResult {
  const submission: SubmissionResult = {
    status: "needs_human_review",
    provider: "generic",
    confidence: 0,
    submitAttempted: false,
    submitCompleted: false,
    failureCategory: "failed_unsupported_widget",
    evidence: {
      finalUrl: job.targetUrl,
      notes: [`provider_not_supported=${provider}`],
    },
  };
  return {
    provider,
    formIR: {
      provider: "generic",
      targetUrl: job.targetUrl,
      questions: [],
      controls: [],
      networkHints: [],
      evidence: [`provider_not_supported=${provider}`],
    },
    submission,
    evidence: submission.evidence,
    rawResult: null,
  };
}
