import assert from "node:assert/strict";
import {
  canonicalizeJobUrl,
  extractProviderJobId,
  leverResultToSubmissionResult,
  leverSnapshotToFormIR,
} from "../lib/form-engine";
import {
  buildLeverQuestionNodes,
  extractLeverCompanySlug,
  extractLeverJobId,
  parseLeverBaseTemplate,
  validateDirectLeverApplicationUrl,
  type LeverFieldObservation,
  type LeverFormFillResult,
  type LeverFormSnapshot,
} from "../lib/lever-fill";
import { hashAshbyPrompt, normalizeAshbyText } from "../lib/ashby-fill";

function leverField(
  questionText: string,
  overrides: Partial<LeverFieldObservation> = {}
): LeverFieldObservation {
  return {
    label: questionText,
    question_text: questionText,
    normalized_prompt: normalizeAshbyText(questionText),
    prompt_hash: hashAshbyPrompt(questionText),
    required: true,
    control_kind: "text",
    selector_hint: `input[name="${normalizeAshbyText(questionText).replace(/\W+/g, "_")}"]`,
    options: [],
    option_signature: null,
    section: null,
    supported: true,
    validation_state: "unknown",
    tag: "input",
    input_type: "text",
    name: null,
    id: null,
    placeholder: null,
    multiple: false,
    card_id: null,
    card_field_index: null,
    provider_key: null,
    ...overrides,
  };
}

function leverSnapshot(
  fields: LeverFieldObservation[],
  overrides: Partial<LeverFormSnapshot> = {}
): LeverFormSnapshot {
  return {
    provider: "lever",
    company_slug: "acme",
    posting_id: "11111111-1111-4111-8111-111111111111",
    hcaptcha_present: false,
    captcha: {
      present: false,
      kinds: [],
      primary: null,
      tokenSelectors: [],
      tokenValueLengths: [],
      frameCount: 0,
      supportedByBrowserbase: false,
      unsupportedReason: null,
    },
    url: "https://jobs.lever.co/acme/11111111-1111-4111-8111-111111111111/apply",
    title: "Apply",
    body_text_sample: "",
    fields,
    questions: buildLeverQuestionNodes(fields),
    validation_errors: [],
    confirmation_texts: [],
    submit_controls: 1,
    unexpected_verification_gate: false,
    notes: [],
    ...overrides,
  };
}

const normalized = validateDirectLeverApplicationUrl(
  "https://jobs.lever.co/acme/11111111-1111-4111-8111-111111111111?utm=1#top"
);
assert.equal(
  normalized.normalizedUrl,
  "https://jobs.lever.co/acme/11111111-1111-4111-8111-111111111111/apply"
);
assert.equal(normalized.companySlug, "acme");
assert.equal(normalized.postingId, "11111111-1111-4111-8111-111111111111");
assert.equal(extractLeverCompanySlug(normalized.normalizedUrl), "acme");
assert.equal(extractLeverJobId(normalized.normalizedUrl), normalized.postingId);
assert.equal(extractProviderJobId("lever", normalized.normalizedUrl), normalized.postingId);
assert.equal(
  canonicalizeJobUrl("https://jobs.lever.co/acme/11111111-1111-4111-8111-111111111111"),
  normalized.normalizedUrl
);

const template = parseLeverBaseTemplate(JSON.stringify({
  id: "card-1",
  text: "Additional information",
  fields: [
    { type: "multiple-choice", text: "Are you authorized to work in the country for which you are applying?", required: true, options: ["Yes", "No"] },
    { type: "dropdown", text: "Which university did you last attend?", required: true, options: [{ text: "Other - School Not Listed" }] },
  ],
}));
assert.equal(template?.id, "card-1");
assert.equal(template?.fields[0]?.type, "multiple-choice");
assert.deepEqual(template?.fields[1]?.options, ["Other - School Not Listed"]);

const form = leverSnapshotToFormIR({
  targetUrl: normalized.normalizedUrl,
  companySlug: "acme",
  postingId: normalized.postingId,
  snapshot: leverSnapshot([
    leverField("Resume/CV", {
      control_kind: "file",
      input_type: "file",
      selector_hint: "input[name=\"resume\"]",
      name: "resume",
    }),
    leverField("Email", {
      control_kind: "email",
      input_type: "email",
      selector_hint: "input[name=\"email\"]",
      name: "email",
    }),
    leverField("Current location", {
      control_kind: "text",
      selector_hint: "input[name=\"location\"]",
      name: "location",
    }),
    leverField("Are you authorized to work in the country for which you are applying?", {
      control_kind: "radio",
      input_type: "radio",
      name: "cards[card-1][field0]",
      card_id: "card-1",
      card_field_index: 0,
      provider_key: "work-auth",
      options: ["Yes", "No"],
      option_signature: "yes|no",
    }),
    leverField("Language skill(s) - check all that apply", {
      control_kind: "checkbox",
      input_type: "checkbox",
      name: "cards[card-2][field0]",
      multiple: true,
      options: ["English (ENG)", "German (DEU)"],
      option_signature: "english (eng)|german (deu)",
    }),
  ]),
});
assert.equal(form.provider, "lever");
assert.equal(form.questions.length, 5);
assert.equal(form.jobMetadata?.providerJobId, normalized.postingId);
assert.equal(form.questions.find((question) => question.rawPrompt === "Resume/CV")?.semanticClass, "resume");
assert.equal(
  form.questions.find((question) => question.rawPrompt.includes("authorized"))?.sensitivity,
  "hard_truth"
);
assert.equal(
  form.controls.find((control) => control.questionId === hashAshbyPrompt("Language skill(s) - check all that apply"))?.type,
  "multi_checkbox"
);

const blockedByCaptcha: LeverFormFillResult = {
  provider: "lever",
  targetUrl: normalized.normalizedUrl,
  finalUrl: normalized.normalizedUrl,
  companySlug: "acme",
  postingId: normalized.postingId,
  submitAttempted: false,
  submitCompleted: false,
  outcome: "blocked_before_submit",
  submissionEvidence: {
    outcome: "blocked_before_submit",
    details: ["submit blocked by required blockers"],
    url: normalized.normalizedUrl,
  },
  plan: {
    resolved_answers: [],
    mapping_decisions: [],
    fill_targets: [],
    missing_required: [],
    unsupported_required: [],
    pending_review: [],
    needs_user_answers: [],
    cached_alias_hits: 0,
    cached_answer_hits: 0,
  },
  fillOperations: [],
  blockers: [{
    kind: "unexpected_verification_gate",
    key: "verification_gate",
    label: null,
    detail: "unexpected verification gate detected",
    selector: null,
  }],
  needsUserAnswers: [],
  preUploadSnapshot: leverSnapshot([]),
  postUploadSnapshot: leverSnapshot([]),
  finalSnapshot: leverSnapshot([], {
    hcaptcha_present: true,
    captcha: {
      present: true,
      kinds: ["hcaptcha"],
      primary: "hcaptcha",
      tokenSelectors: ["#hcaptchaResponseInput", "[name='h-captcha-response']"],
      tokenValueLengths: [0],
      frameCount: 2,
      supportedByBrowserbase: false,
      unsupportedReason: "captcha type hcaptcha is not in BROWSERBASE_SUPPORTED_CAPTCHA_KINDS",
    },
    unexpected_verification_gate: true,
  }),
  runGrade: {
    discovered_question_count: 0,
    required_question_count: 0,
    mapped_question_count: 0,
    deterministic_match_count: 0,
    cache_hit_count: 0,
    llm_match_count: 0,
    auto_accepted_count: 0,
    unresolved_blocking_count: 1,
    verification_failure_count: 0,
    submit_ready: false,
  },
  screenshots: [],
  notes: [],
  errors: [],
};
const submission = leverResultToSubmissionResult(blockedByCaptcha);
assert.equal(submission.provider, "lever");
assert.equal(submission.status, "needs_human_review");
assert.equal(submission.failureCategory, "failed_captcha_or_bot_challenge");

const browserbaseHcaptchaTimeout = leverResultToSubmissionResult({
  ...blockedByCaptcha,
  submitAttempted: true,
  outcome: "unsupported_gate",
  submissionEvidence: {
    outcome: "unsupported_gate",
    details: ["Browserbase hCaptcha solving started but did not finish; no CAPTCHA token was produced"],
    url: normalized.normalizedUrl,
  },
  blockers: [{
    kind: "unexpected_verification_gate",
    key: "browserbase_hcaptcha_timeout",
    label: null,
    detail: "Browserbase hCaptcha solving started but did not finish; no CAPTCHA token was produced",
    selector: "#h-captcha",
  }],
});
assert.equal(browserbaseHcaptchaTimeout.status, "failed");
assert.equal(browserbaseHcaptchaTimeout.failureCategory, "failed_captcha_or_bot_challenge");

console.log("Lever fill tests passed");
