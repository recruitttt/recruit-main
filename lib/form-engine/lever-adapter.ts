import type {
  LeverFieldObservation,
  LeverFormFillResult,
  LeverFormSnapshot,
  LeverQuestionNode,
} from "../lever-fill/types";
import { extractLeverCompanySlug, extractLeverJobId } from "../lever-fill/core";
import { inferSemanticClass, classifyQuestionSensitivity } from "./safety";
import { normalizeFormText } from "./validation";
import type {
  ControlDescriptor,
  ControlType,
  FormIR,
  QuestionIR,
  SubmissionResult,
} from "./types";

export function leverSnapshotToFormIR(args: {
  snapshot: LeverFormSnapshot;
  targetUrl: string;
  companySlug?: string | null;
  postingId?: string | null;
}): FormIR {
  const questions = args.snapshot.questions.map((question) => leverQuestionToQuestionIR(question));
  const controls = args.snapshot.questions.flatMap((question) => leverQuestionToControls(question));

  return {
    provider: "lever",
    targetUrl: args.targetUrl,
    finalUrl: args.snapshot.url,
    jobMetadata: {
      company: args.companySlug ?? extractLeverCompanySlug(args.targetUrl),
      providerJobId: args.postingId ?? extractLeverJobId(args.targetUrl),
    },
    questions,
    controls,
    networkHints: [],
    evidence: [
      `discovered_questions=${questions.length}`,
      `validation_errors=${args.snapshot.validation_errors.length}`,
      `submit_controls=${args.snapshot.submit_controls}`,
      `hcaptcha_present=${args.snapshot.hcaptcha_present}`,
      `captcha_primary=${args.snapshot.captcha.primary ?? "none"}`,
      `captcha_supported=${args.snapshot.captcha.supportedByBrowserbase}`,
    ],
  };
}

export function leverResultToSubmissionResult(result: LeverFormFillResult): SubmissionResult {
  const status = (() => {
    if (result.outcome === "confirmed") return "confirmed" as const;
    if (result.outcome === "ambiguous" && result.submitAttempted) return "likely_submitted" as const;
    if (result.outcome === "blocked_before_submit" || !result.submitAttempted) return "needs_human_review" as const;
    return "failed" as const;
  })();
  const confidence = (() => {
    if (result.outcome === "confirmed") return 0.99;
    if (result.outcome === "ambiguous" && result.submitAttempted) return 0.55;
    if (!result.submitAttempted) return result.blockers.length === 0 ? 0.75 : 0.2;
    return 0.1;
  })();

  return {
    status,
    provider: "lever",
    confidence,
    submitAttempted: result.submitAttempted,
    submitCompleted: result.submitCompleted,
    failureCategory: failureCategoryForLeverOutcome(result),
    evidence: {
      finalUrl: result.finalUrl,
      successText: result.submissionEvidence.outcome === "confirmed"
        ? result.submissionEvidence.details
        : [],
      validationErrors: result.submissionEvidence.outcome === "rejected_validation"
        ? result.submissionEvidence.details
        : result.finalSnapshot.validation_errors,
      screenshotRefs: result.screenshots.map((screenshot) => ({
        label: screenshot.label,
        byteLength: screenshot.byteLength,
      })),
      notes: [
        ...result.notes,
        `company_slug=${result.companySlug}`,
        `posting_id=${result.postingId}`,
        `hcaptcha_present=${result.finalSnapshot.hcaptcha_present}`,
      ],
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

function leverQuestionToQuestionIR(question: LeverQuestionNode): QuestionIR {
  const normalizedPrompt = normalizeFormText(question.normalized_prompt || question.question_text);
  const representative = question.representative_field as LeverFieldObservation;
  const providerKey = representative.provider_key ?? question.prompt_hash;
  const semanticClass = inferSemanticClass(normalizedPrompt, providerKey);
  const draft: QuestionIR = {
    id: question.prompt_hash,
    rawPrompt: question.question_text,
    normalizedPrompt,
    semanticClass,
    required: {
      value: question.required,
      confidence: question.required ? 0.85 : 0.5,
      evidence: question.required ? ["lever_dom_or_schema_required"] : ["lever_dom_not_required"],
    },
    sensitivity: "unsupported",
    options: question.options,
    providerKey,
    evidence: [
      `control_kind=${question.control_kind}`,
      `widget_family=${question.widget_family}`,
      ...(question.option_signature ? [`option_signature=${question.option_signature}`] : []),
      ...(representative.card_id ? [`card_id=${representative.card_id}`] : []),
      representative.card_field_index != null
        ? `card_field_index=${representative.card_field_index}`
        : null,
    ].filter((item): item is string => Boolean(item)),
  };

  return {
    ...draft,
    sensitivity: classifyQuestionSensitivity(draft),
  };
}

function leverQuestionToControls(question: LeverQuestionNode): ControlDescriptor[] {
  const optionNodes = question.options.map((option, index) => ({
    id: `${question.prompt_hash}:option:${index}`,
    label: option,
    value: option,
    selector: null,
    confidence: 0.65,
  }));
  const type = controlTypeForLever(question.control_kind, question.question_text, question.representative_field.multiple);
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

function controlTypeForLever(controlKind: string, prompt: string, multiple: boolean): ControlType {
  if (controlKind === "textarea") return "textarea";
  if (controlKind === "email") return "email";
  if (controlKind === "tel") return "phone";
  if (controlKind === "file") return "file";
  if (controlKind === "radio") return "radio";
  if (controlKind === "checkbox") return multiple ? "multi_checkbox" : "checkbox";
  if (controlKind === "select") return "select";
  if (controlKind === "combobox") return "combobox";
  if (controlKind === "text" && normalizeFormText(prompt).includes("date")) return "date";
  if (controlKind === "text" && normalizeFormText(prompt).includes("location")) return "autocomplete";
  if (controlKind === "text") return "text";
  return "unknown";
}

function failureCategoryForLeverOutcome(
  result: LeverFormFillResult
): SubmissionResult["failureCategory"] {
  if (result.outcome === "confirmed") return undefined;
  if (result.finalSnapshot.hcaptcha_present || result.outcome === "unsupported_gate") {
    return "failed_captcha_or_bot_challenge";
  }
  if (result.outcome === "blocked_before_submit" || !result.submitAttempted) {
    if (result.blockers.some((blocker) => blocker.kind === "unsupported_required_field")) {
      return "failed_unsupported_widget";
    }
    return "failed_user_input_required";
  }
  if (result.outcome === "rejected_validation") return "failed_repairable";
  if (result.outcome === "rejected_spam") return "failed_repairable";
  if (result.outcome === "ambiguous" && result.submitAttempted) return "submitted_probable";
  return "failed_repairable";
}
