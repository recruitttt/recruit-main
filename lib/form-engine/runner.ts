import { runAshbyFormFillOnPage, type AshbyPageLike } from "../ashby-fill/browser";
import type { AshbyApprovedAnswer, AshbyPromptAlias } from "../ashby-fill/types";
import { ashbyResultToSubmissionResult, ashbySnapshotToFormIR, detectProviderFromUrl } from "./ashby-adapter";
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

export async function runFormAutomation(args: RunFormAutomationArgs): Promise<RunFormAutomationResult> {
  const provider = args.job.provider ?? args.job.providerHint ?? detectProviderFromUrl(args.job.targetUrl);
  if (provider !== "ashby") {
    return unsupportedProviderResult(args.job, provider);
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
