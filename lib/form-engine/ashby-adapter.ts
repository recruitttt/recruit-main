import type { AshbyFormFillResult } from "../ashby-fill/browser";
import type { AshbyFormSnapshot, AshbyQuestionNode } from "../ashby-fill/types";
import { inferSemanticClass, classifyQuestionSensitivity } from "./safety";
import { normalizeFormText } from "./validation";
import type {
  ControlDescriptor,
  ControlType,
  FormIR,
  FormProvider,
  QuestionIR,
  SubmissionResult,
} from "./types";

export function detectProviderFromUrl(targetUrl: string): FormProvider {
  try {
    const url = new URL(targetUrl);
    if (url.hostname.toLowerCase() === "jobs.ashbyhq.com") return "ashby";
    if (url.hostname.toLowerCase().includes("greenhouse")) return "greenhouse";
    if (url.hostname.toLowerCase().includes("lever.co")) return "lever";
    if (url.hostname.toLowerCase().includes("workdayjobs")) return "workday";
  } catch {
    // fall through
  }
  return "generic";
}

export function ashbySnapshotToFormIR(args: {
  snapshot: AshbyFormSnapshot;
  targetUrl: string;
  organizationSlug?: string | null;
}): FormIR {
  const questions = args.snapshot.questions.map((question) => ashbyQuestionToQuestionIR(question));
  const controls = args.snapshot.questions.flatMap((question) => ashbyQuestionToControls(question));

  return {
    provider: "ashby",
    targetUrl: args.targetUrl,
    finalUrl: args.snapshot.url,
    jobMetadata: {
      company: args.organizationSlug ?? null,
      providerJobId: ashbyJobIdFromUrl(args.targetUrl),
    },
    questions,
    controls,
    networkHints: [],
    evidence: [
      `discovered_questions=${questions.length}`,
      `validation_errors=${args.snapshot.validation_errors.length}`,
      `submit_controls=${args.snapshot.submit_controls}`,
    ],
  };
}

export function ashbyResultToSubmissionResult(result: AshbyFormFillResult): SubmissionResult {
  const status = (() => {
    if (result.outcome === "confirmed") return "confirmed" as const;
    if (result.outcome === "ambiguous" && result.submitAttempted) return "likely_submitted" as const;
    if (result.outcome === "blocked_before_submit") return "needs_human_review" as const;
    return "failed" as const;
  })();
  const confidence = (() => {
    if (result.outcome === "confirmed") return 0.99;
    if (result.outcome === "ambiguous" && result.submitAttempted) return 0.55;
    if (result.outcome === "blocked_before_submit") return 0.2;
    return 0.1;
  })();

  return {
    status,
    provider: "ashby",
    confidence,
    submitAttempted: result.submitAttempted,
    submitCompleted: result.submitCompleted,
    failureCategory: failureCategoryForAshbyOutcome(result.outcome, result.submitAttempted),
    evidence: {
      finalUrl: result.finalUrl,
      successText: result.submissionEvidence.outcome === "confirmed"
        ? result.submissionEvidence.details
        : [],
      validationErrors: result.submissionEvidence.outcome === "rejected_validation"
        ? result.submissionEvidence.details
        : [],
      screenshotRefs: result.screenshots.map((screenshot) => ({
        label: screenshot.label,
        byteLength: screenshot.byteLength,
      })),
      notes: result.notes,
      raw: {
        outcome: result.outcome,
        blockers: result.blockers,
        runGrade: result.runGrade,
        submitAttempted: result.submitAttempted,
        submitCompleted: result.submitCompleted,
      },
    },
  };
}

function ashbyQuestionToQuestionIR(question: AshbyQuestionNode): QuestionIR {
  const semanticClass = inferSemanticClass(question.normalized_prompt, question.prompt_hash);
  const draft: QuestionIR = {
    id: question.prompt_hash,
    rawPrompt: question.question_text,
    normalizedPrompt: question.normalized_prompt,
    semanticClass,
    required: {
      value: question.required,
      confidence: question.required ? 0.75 : 0.45,
      evidence: question.required ? ["ashby_dom_required"] : ["ashby_dom_not_required"],
    },
    sensitivity: "unsupported",
    options: question.options,
    providerKey: question.prompt_hash,
    evidence: [
      `control_kind=${question.control_kind}`,
      `widget_family=${question.widget_family}`,
      ...(question.option_signature ? [`option_signature=${question.option_signature}`] : []),
    ],
  };

  return {
    ...draft,
    sensitivity: classifyQuestionSensitivity(draft),
  };
}

function ashbyQuestionToControls(question: AshbyQuestionNode): ControlDescriptor[] {
  const optionNodes = question.options.map((option, index) => ({
    id: `${question.prompt_hash}:option:${index}`,
    label: option,
    value: option,
    selector: null,
    confidence: 0.55,
  }));
  const type = controlTypeForAshby(question.control_kind, question.question_text);
  return question.source_controls.map((control, index) => ({
    id: `${question.prompt_hash}:control:${index}`,
    questionId: question.prompt_hash,
    type,
    selector: control.selector,
    locatorStrategy: control.selector
      ? { kind: "css", value: control.selector }
      : { kind: "provider", value: question.prompt_hash },
    currentValue: null,
    optionNodes: optionNodes.length > 0 ? optionNodes : undefined,
    validationHint: question.validation_state === "invalid" ? "invalid" : null,
    confidence: control.selector ? 0.8 : 0.45,
  }));
}

function controlTypeForAshby(controlKind: string, prompt: string): ControlType {
  if (controlKind === "textarea") return "textarea";
  if (controlKind === "email") return "email";
  if (controlKind === "tel") return "phone";
  if (controlKind === "file") return "file";
  if (controlKind === "radio") return "radio";
  if (controlKind === "checkbox") return "checkbox";
  if (controlKind === "select") return "select";
  if (controlKind === "combobox") return "combobox";
  if (controlKind === "text" && normalizeFormText(prompt).includes("date")) return "date";
  if (controlKind === "text" && normalizeFormText(prompt).includes("location")) return "autocomplete";
  if (controlKind === "text") return "text";
  return "unknown";
}

function ashbyJobIdFromUrl(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

function failureCategoryForAshbyOutcome(
  outcome: AshbyFormFillResult["outcome"],
  submitAttempted: boolean
): SubmissionResult["failureCategory"] {
  if (outcome === "confirmed") return undefined;
  if (outcome === "unsupported_gate") return "failed_captcha_or_bot_challenge";
  if (outcome === "blocked_before_submit") return "failed_user_input_required";
  if (outcome === "rejected_validation") return "failed_repairable";
  if (outcome === "rejected_spam") return "failed_repairable";
  if (outcome === "ambiguous" && submitAttempted) return "submitted_probable";
  return "failed_repairable";
}
