import assert from "node:assert/strict";
import {
  ashbyResultToSubmissionResult,
  ashbySnapshotToFormIR,
  buildAnswerDecision,
  canonicalizeJobUrl,
  classifyQuestionSensitivity,
  computeApplicationIdempotencyKey,
  detectProviderFromUrl,
  extractMissingRequiredLabels,
  inferSemanticClass,
  normalizeFormText,
  validationLabelMatchesQuestion,
  type QuestionIR,
} from "../lib/form-engine";
import {
  buildAshbyQuestionNodes,
  hashAshbyPrompt,
  normalizeAshbyText,
  type AshbyFieldObservation,
  type AshbyFormSnapshot,
} from "../lib/ashby-fill";
import type { AshbyFormFillResult } from "../lib/ashby-fill/browser";

function field(
  questionText: string,
  overrides: Partial<AshbyFieldObservation> = {}
): AshbyFieldObservation {
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
    ...overrides,
  };
}

function snapshot(fields: AshbyFieldObservation[]): AshbyFormSnapshot {
  return {
    url: "https://jobs.ashbyhq.com/acme/123/application",
    title: "Apply",
    body_text_sample: "",
    fields,
    questions: buildAshbyQuestionNodes(fields),
    validation_errors: [],
    confirmation_texts: [],
    submit_controls: 1,
    unexpected_verification_gate: false,
    notes: [],
  };
}

assert.equal(detectProviderFromUrl("https://jobs.ashbyhq.com/acme/123"), "ashby");
assert.equal(detectProviderFromUrl("https://boards.greenhouse.io/acme/jobs/123"), "greenhouse");
assert.equal(detectProviderFromUrl("https://example.com/jobs/123"), "generic");

assert.equal(
  canonicalizeJobUrl("https://jobs.ashbyhq.com/acme/123?utm_source=x#top"),
  "https://jobs.ashbyhq.com/acme/123/application"
);
assert.equal(
  computeApplicationIdempotencyKey({
    demoUserId: "demo",
    provider: "ashby",
    targetUrl: "https://jobs.ashbyhq.com/acme/123",
    company: "Acme",
    title: "Engineer",
  }),
  computeApplicationIdempotencyKey({
    demoUserId: "demo",
    provider: "ashby",
    targetUrl: "https://jobs.ashbyhq.com/acme/123/application?utm=1",
    company: "acme",
    title: " engineer ",
  })
);

const form = ashbySnapshotToFormIR({
  targetUrl: "https://jobs.ashbyhq.com/acme/123/application",
  organizationSlug: "acme",
  snapshot: snapshot([
    field("Email Address", { control_kind: "email", input_type: "email" }),
    field("CV/Resume", { control_kind: "file", input_type: "file" }),
    field("Do you currently have right to work in the location you have applied", {
      control_kind: "radio",
      input_type: "radio",
      options: ["Yes, I have ongoing right to work", "No"],
      option_signature: "yes, i have ongoing right to work|no",
    }),
  ]),
});
assert.equal(form.provider, "ashby");
assert.equal(form.questions.length, 3);
assert.equal(form.controls.length, 3);
assert.equal(form.questions.find((question) => question.rawPrompt === "CV/Resume")?.semanticClass, "resume");
assert.equal(
  form.questions.find((question) => question.rawPrompt.includes("right to work"))?.sensitivity,
  "hard_truth"
);

const customQuestion: QuestionIR = {
  id: "custom",
  rawPrompt: "Why are you interested in this role?",
  normalizedPrompt: normalizeFormText("Why are you interested in this role?"),
  semanticClass: "custom",
  required: { value: true, confidence: 0.8, evidence: ["fixture"] },
  sensitivity: "llm_allowed_custom",
  options: [],
  evidence: [],
};
assert.equal(classifyQuestionSensitivity(customQuestion), "llm_allowed_custom");
assert.equal(inferSemanticClass("will you require visa sponsorship"), "sponsorship");

const llmCustom = buildAnswerDecision({
  question: customQuestion,
  value: "I am interested because the role aligns with my product engineering work.",
  source: "llm",
});
assert.equal(llmCustom.maySubmit, true);
assert.equal(llmCustom.status, "llm_allowed");

const hardTruthQuestion: QuestionIR = {
  ...customQuestion,
  id: "auth",
  rawPrompt: "Are you authorized to work in the United States?",
  normalizedPrompt: normalizeFormText("Are you authorized to work in the United States?"),
  semanticClass: "work_authorization",
  sensitivity: "hard_truth",
};
const llmHardTruth = buildAnswerDecision({
  question: hardTruthQuestion,
  value: "Yes",
  source: "llm",
});
assert.equal(llmHardTruth.maySubmit, false);
assert.equal(llmHardTruth.status, "blocked_hard_truth");

const labels = extractMissingRequiredLabels([
  "Your form needs corrections Missing entry for required field: Location Missing entry for required field: How did you hear about us? Submit Application",
]);
assert.deepEqual(labels, ["Location", "How did you hear about us?"]);
assert.equal(validationLabelMatchesQuestion("How did you hear about us?", {
  rawPrompt: "How did you hear about us?",
  normalizedPrompt: "how did you hear about us?",
}), true);

const confirmedAshbyResult: AshbyFormFillResult = {
  provider: "ashby",
  targetUrl: "https://jobs.ashbyhq.com/acme/123/application",
  finalUrl: "https://jobs.ashbyhq.com/acme/123/application",
  organizationSlug: "acme",
  submitAttempted: true,
  submitCompleted: true,
  outcome: "confirmed",
  submissionEvidence: { outcome: "confirmed", details: ["successfully submitted"], url: "https://jobs.ashbyhq.com/acme/123/application" },
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
  blockers: [],
  needsUserAnswers: [],
  preUploadSnapshot: snapshot([]),
  postUploadSnapshot: snapshot([]),
  finalSnapshot: snapshot([]),
  runGrade: {
    discovered_question_count: 0,
    required_question_count: 0,
    mapped_question_count: 0,
    deterministic_match_count: 0,
    cache_hit_count: 0,
    llm_match_count: 0,
    auto_accepted_count: 0,
    unresolved_blocking_count: 0,
    verification_failure_count: 0,
    submit_ready: true,
  },
  screenshots: [{ label: "post-submit", captured: true, byteLength: 42 }],
  notes: [],
  errors: [],
};
const confirmed = ashbyResultToSubmissionResult(confirmedAshbyResult);
assert.equal(confirmed.status, "confirmed");
assert.equal(confirmed.confidence, 0.99);
assert.equal(confirmed.evidence.successText?.[0], "successfully submitted");

console.log("Form engine tests passed");
