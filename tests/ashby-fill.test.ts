import assert from "node:assert/strict";
import {
  buildAshbyOptionSignature,
  buildAshbyProfileAnswers,
  buildAshbyQuestionNodes,
  buildAshbyResolutionPlan,
  buildRunGrade,
  classifySubmissionSnapshot,
  evaluateSubmitReadiness,
  hashAshbyPrompt,
  isOpenAiDraftCandidate,
  normalizeAshbyText,
  validateDirectAshbyApplicationUrl,
  type AshbyFieldObservation,
  type AshbyFormSnapshot,
  type AshbyPromptAlias,
} from "../lib/ashby-fill";

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

assert.equal(normalizeAshbyText("  Are you\nAuthorized? "), "are you authorized?");
assert.equal(hashAshbyPrompt("Email"), hashAshbyPrompt(" email "));
assert.equal(buildAshbyOptionSignature(["Yes", "No", "Yes"]), "yes|no");
assert.deepEqual(validateDirectAshbyApplicationUrl("https://jobs.ashbyhq.com/acme/123/application"), {
  normalizedUrl: "https://jobs.ashbyhq.com/acme/123/application",
  organizationSlug: "acme",
});
assert.deepEqual(validateDirectAshbyApplicationUrl("https://jobs.ashbyhq.com/acme/123"), {
  normalizedUrl: "https://jobs.ashbyhq.com/acme/123/application",
  organizationSlug: "acme",
});
assert.throws(() => validateDirectAshbyApplicationUrl("https://example.com/acme/123/application"));

const radioFields = [
  field("Are you legally authorized to work in the United States?", {
    control_kind: "radio",
    input_type: "radio",
    name: "auth",
    options: ["Yes", "No"],
    option_signature: "yes|no",
    selector_hint: 'input[name="auth"][value="Yes"]',
  }),
  field("Are you legally authorized to work in the United States?", {
    control_kind: "radio",
    input_type: "radio",
    name: "auth",
    options: ["Yes", "No"],
    option_signature: "yes|no",
    selector_hint: 'input[name="auth"][value="No"]',
  }),
];
const grouped = buildAshbyQuestionNodes(radioFields);
assert.equal(grouped.length, 1);
assert.deepEqual(grouped[0]?.options, ["Yes", "No"]);

const profileAnswers = buildAshbyProfileAnswers({
  name: "Taylor Candidate",
  email: "taylor@example.com",
  phone: "+1 555 0100",
  location: "San Francisco, CA",
  links: {
    linkedin: "https://linkedin.com/in/taylor",
    github: "https://github.com/taylor",
  },
  prefs: { workAuth: "Authorized in the US" },
});
assert.equal(profileAnswers.first_name, "Taylor");
assert.equal(profileAnswers.last_name, "Candidate");
assert.equal(profileAnswers.work_authorized_us, "Yes");
assert.equal(profileAnswers.github_url, "https://github.com/taylor");
assert.equal(profileAnswers.phone, "+1 555 0100");
assert.equal(profileAnswers.primary_tech_stack, null);

const commonSnapshot = snapshot([
  field("Email Address", { input_type: "email", control_kind: "email" }),
  field("Phone Number", { input_type: "tel", control_kind: "tel" }),
  field("Are you legally authorized to work in the United States?", {
    control_kind: "radio",
    input_type: "radio",
    name: "auth",
    options: ["Yes", "No"],
    option_signature: "yes|no",
  }),
]);
const plan = buildAshbyResolutionPlan({
  snapshot: commonSnapshot,
  profileAnswers,
  organizationSlug: "acme",
});
assert.equal(plan.fill_targets.length, 3);
assert.equal(plan.missing_required.length, 0);
assert.equal(plan.fill_targets.find((target) => target.canonical_key === "work_authorized_us")?.value, "Yes");

const trainGapProfileAnswers = buildAshbyProfileAnswers({
  name: "Taylor Candidate",
  email: "taylor@example.com",
  contact: { contactNumber: "+1 555 0100" },
  application: {
    earliestStartDate: "2026-05-15",
    noticePeriod: "Two weeks",
    salaryExpectations: "$180,000",
    rustSkillRating: "4",
    onsitePreference: "Yes",
    locationPreference: "UK [Remote]",
    workLocationPreference: "Remote",
  },
  skills: ["TypeScript", "React", "Node.js"],
  links: {},
});
const trainGapPlan = buildAshbyResolutionPlan({
  snapshot: snapshot([
    field("Contact number", { input_type: "tel", control_kind: "tel" }),
    field("Pick date..."),
    field("What is your notice period?"),
    field("Salary Expectations"),
    field("On a scale of Beginner (0) to Advanced(10) , where do you feel you sit regarding Rust?"),
    field("Are you able to work 50% of the time in the office location mentioned in the job description?", {
      control_kind: "radio",
      input_type: "radio",
      options: ["Yes", "No"],
      option_signature: "yes|no",
    }),
    field("Attio Privacy Notice", {
      control_kind: "checkbox",
      input_type: "checkbox",
      options: ["Yes", "No"],
      option_signature: "yes|no",
    }),
    field("What is your prefered working location", {
      control_kind: "radio",
      input_type: "radio",
      options: ["London [Hybrid]", "UK [Remote]"],
      option_signature: "london [hybrid]|uk [remote]",
    }),
    field("What is your main development language", {
      control_kind: "radio",
      input_type: "radio",
      options: ["Python", "C++", "Javascript/Typescript", "Java", "Other"],
      option_signature: "python|c++|javascript/typescript|java|other",
    }),
    field("What is your primary tech stack? Please specify the programming languages and libraries/frameworks you have used most frequently."),
  ]),
  profileAnswers: trainGapProfileAnswers,
  organizationSlug: "attio",
});
assert.equal(trainGapPlan.missing_required.length, 0);
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "phone")?.value, "+1 555 0100");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "earliest_start_date")?.value, "2026-05-15");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "notice_period")?.value, "Two weeks");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "salary_expectations")?.value, "$180,000");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "rust_skill_rating")?.value, "4");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "commute_or_relocate")?.value, "Yes");
assert.equal(
  trainGapPlan.fill_targets.find((target) => target.canonical_key === "primary_tech_stack")?.value,
  "TypeScript, React, Node.js"
);
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "data_processing_consent")?.value, "Yes");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "preferred_working_location")?.value, "UK [Remote]");
assert.equal(trainGapPlan.fill_targets.find((target) => target.canonical_key === "main_development_language")?.value, "Javascript/Typescript");

const genericRemoteLocationPlan = buildAshbyResolutionPlan({
  snapshot: snapshot([
    field("What is your prefered working location", {
      control_kind: "radio",
      input_type: "radio",
      options: ["Germany [Remote]", "Ireland [Remote]", "Poland [Remote]", "Portugal [Remote]"],
      option_signature: "germany [remote]|ireland [remote]|poland [remote]|portugal [remote]",
    }),
  ]),
  profileAnswers: buildAshbyProfileAnswers({
    location: "Vancouver, BC, Canada",
    application: { workLocationPreference: "Remote" },
    prefs: { locations: ["Remote"] },
  }),
  organizationSlug: "attio",
});
assert.equal(genericRemoteLocationPlan.fill_targets.length, 0);
assert.equal(genericRemoteLocationPlan.missing_required[0]?.key, "preferred_working_location");

const customRequired = snapshot([field("What is your favorite distributed systems paper?")]);
const customPlan = buildAshbyResolutionPlan({
  snapshot: customRequired,
  profileAnswers,
  organizationSlug: "acme",
});
assert.equal(customPlan.fill_targets.length, 0);
assert.equal(customPlan.pending_review.length, 1);
assert.equal(evaluateSubmitReadiness([], customPlan.missing_required, [], customPlan.pending_review).allowed, false);

const customRequiredQuestion = customRequired.questions[0]!;
const draftPlan = buildAshbyResolutionPlan({
  snapshot: customRequired,
  profileAnswers,
  organizationSlug: "acme",
  draftAnswers: [{
    provider: "ashby",
    promptHash: customRequiredQuestion.prompt_hash,
    questionText: customRequiredQuestion.question_text,
    normalizedPrompt: customRequiredQuestion.normalized_prompt,
    answerValue: "I would discuss DynamoDB because it has shaped how I think about distributed systems.",
    answerKind: "text",
    confidence: "weak",
    source: "llm",
    sourceDetail: "test",
    rationale: "drafted from profile context",
    evidence: ["skills"],
    requiresReview: true,
    reviewStatus: "pending_review",
  }],
});
assert.equal(draftPlan.fill_targets.length, 0);
assert.equal(draftPlan.missing_required.length, 0);
assert.equal(draftPlan.pending_review[0]?.reason, "draft answer requires review");
assert.equal(evaluateSubmitReadiness([], draftPlan.missing_required, [], draftPlan.pending_review).allowed, false);

const draftFillPlan = buildAshbyResolutionPlan({
  snapshot: customRequired,
  profileAnswers,
  organizationSlug: "acme",
  draftAnswerMode: "fill",
  draftAnswers: [{
    provider: "ashby",
    promptHash: customRequiredQuestion.prompt_hash,
    questionText: customRequiredQuestion.question_text,
    normalizedPrompt: customRequiredQuestion.normalized_prompt,
    answerValue: "I would discuss DynamoDB because it has shaped how I think about distributed systems.",
    answerKind: "text",
    confidence: "weak",
    source: "llm",
    sourceDetail: "test",
    rationale: "drafted from profile context",
    evidence: ["skills"],
    requiresReview: true,
    reviewStatus: "pending_review",
  }],
});
assert.equal(draftFillPlan.fill_targets.length, 1);
assert.equal(draftFillPlan.pending_review.length, 0);
assert.equal(evaluateSubmitReadiness(
  [{
    key: draftFillPlan.fill_targets[0]!.canonical_key,
    status: "filled",
    selector: draftFillPlan.fill_targets[0]!.field.selector_hint,
    detail: null,
    verified: true,
    blocking: true,
  }],
  draftFillPlan.missing_required,
  [],
  draftFillPlan.pending_review,
  commonSnapshot
).allowed, true);

const strongDraftFillPlan = buildAshbyResolutionPlan({
  snapshot: customRequired,
  profileAnswers,
  organizationSlug: "acme",
  draftAnswerMode: "fill",
  draftAnswers: [{
    provider: "ashby",
    promptHash: customRequiredQuestion.prompt_hash,
    questionText: customRequiredQuestion.question_text,
    normalizedPrompt: customRequiredQuestion.normalized_prompt,
    answerValue: "My systems experience is grounded in TypeScript and Node.js services where consistency and reliability shaped architecture decisions.",
    answerKind: "text",
    confidence: "strong",
    source: "llm",
    sourceDetail: "test",
    rationale: "grounded in skills and experience",
    evidence: ["skills", "experience"],
    requiresReview: false,
    reviewStatus: "post_submit_review",
  }],
});
assert.equal(strongDraftFillPlan.fill_targets.length, 1);
assert.equal(strongDraftFillPlan.pending_review.length, 0);
assert.equal(strongDraftFillPlan.resolved_answers[0]?.source, "llm_best_attempt");
assert.equal(strongDraftFillPlan.resolved_answers[0]?.review_status, "post_submit_review");
assert.equal(evaluateSubmitReadiness(
  [{
    key: strongDraftFillPlan.fill_targets[0]!.canonical_key,
    status: "filled",
    selector: strongDraftFillPlan.fill_targets[0]!.field.selector_hint,
    detail: null,
    verified: true,
    blocking: true,
  }],
  strongDraftFillPlan.missing_required,
  [],
  strongDraftFillPlan.pending_review,
  commonSnapshot
).allowed, true);

assert.equal(isOpenAiDraftCandidate(snapshot([field("What is your date of birth?")]).questions[0]!), false);

const missingSubmit = evaluateSubmitReadiness([], [], [], [], { ...commonSnapshot, submit_controls: 0 });
assert.equal(missingSubmit.allowed, false);
assert.equal(missingSubmit.blockers[0]?.kind, "submit_control_missing");

const duplicateResumePlan = buildAshbyResolutionPlan({
  snapshot: snapshot([
    field("Autofill from resume Upload your resume here to autofill key application fields. Upload file", {
      control_kind: "file",
      input_type: "file",
      selector_hint: 'input[name="autofill_resume"]',
    }),
    field("Resume", {
      control_kind: "file",
      input_type: "file",
      selector_hint: 'input[name="resume"]',
    }),
  ]),
  profileAnswers,
  organizationSlug: "acme",
});
assert.equal(duplicateResumePlan.missing_required.length, 1);
assert.equal(duplicateResumePlan.pending_review.length, 1);
assert.equal(duplicateResumePlan.missing_required[0]?.label, "Resume");

const duplicateResumeUploadPlan = buildAshbyResolutionPlan({
  snapshot: snapshot([
    field("Autofill from resume Upload your resume here to autofill key application fields. Upload file", {
      control_kind: "file",
      input_type: "file",
      selector_hint: 'input[name="autofill_resume"]',
    }),
    field("Resume", {
      control_kind: "file",
      input_type: "file",
      selector_hint: 'input[name="resume"]',
    }),
  ]),
  profileAnswers: { ...profileAnswers, resume_file: "/tmp/taylor-resume.pdf" },
  organizationSlug: "acme",
});
assert.equal(duplicateResumeUploadPlan.fill_targets.length, 1);
assert.equal(duplicateResumeUploadPlan.fill_targets[0]?.canonical_key, "resume_file");
assert.equal(duplicateResumeUploadPlan.fill_targets[0]?.field.selector_hint, 'input[name="resume"]');

const aliasQuestion = "Personal project demo link";
const aliasHash = hashAshbyPrompt(aliasQuestion)!;
const aliases: AshbyPromptAlias[] = [{
  provider: "ashby",
  scopeKind: "organization",
  scopeValue: "acme",
  promptHash: aliasHash,
  normalizedPrompt: normalizeAshbyText(aliasQuestion),
  controlKind: "text",
  optionSignature: null,
  canonicalKey: "github_url",
  confidence: "strong",
  source: "test",
  approved: true,
}];
const aliasPlan = buildAshbyResolutionPlan({
  snapshot: snapshot([field(aliasQuestion)]),
  profileAnswers,
  aliases,
  organizationSlug: "acme",
});
assert.equal(aliasPlan.cached_alias_hits, 1);
assert.equal(aliasPlan.fill_targets[0]?.canonical_key, "github_url");

const ready = evaluateSubmitReadiness(
  [{ key: "email", status: "filled", selector: "#email", detail: null, verified: true, blocking: true }],
  [],
  [],
  [],
  commonSnapshot
);
assert.equal(ready.allowed, true);

const blocked = evaluateSubmitReadiness(
  [{ key: "email", status: "failed", selector: "#email", detail: "value did not stick", verified: false, blocking: true }],
  [],
  []
);
assert.equal(blocked.allowed, false);
assert.equal(blocked.blockers[0]?.kind, "fill_verification_failed");

assert.equal(classifySubmissionSnapshot({
  ...commonSnapshot,
  confirmation_texts: ["application submitted"],
  submit_controls: 0,
}).outcome, "confirmed");
assert.equal(classifySubmissionSnapshot({
  ...commonSnapshot,
  validation_errors: ["Email is required"],
}).outcome, "rejected_validation");
assert.equal(classifySubmissionSnapshot({
  ...commonSnapshot,
  validation_errors: ["Your application was marked as possible spam"],
}).outcome, "rejected_spam");
assert.equal(classifySubmissionSnapshot({
  ...commonSnapshot,
  unexpected_verification_gate: true,
}).outcome, "unsupported_gate");

const grade = buildRunGrade({
  snapshot: commonSnapshot,
  plan,
  fillOperations: plan.fill_targets.map((target) => ({
    key: target.canonical_key,
    status: "filled",
    selector: target.field.selector_hint,
    detail: null,
    verified: true,
    blocking: true,
  })),
  submitReady: true,
});
assert.equal(grade.discovered_question_count, 3);
assert.equal(grade.submit_ready, true);

console.log("Ashby fill core tests passed");
