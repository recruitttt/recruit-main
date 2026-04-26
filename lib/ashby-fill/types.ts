export type AshbyControlKind =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "radio"
  | "checkbox"
  | "file"
  | "select"
  | "combobox"
  | "unsupported";

export type AshbyWidgetFamily =
  | "text_like"
  | "choice_group"
  | "select_like"
  | "file_upload"
  | "unsupported";

export type AshbyValidationState = "valid" | "invalid" | "unknown";

export type AshbyMatchConfidence = "exact" | "strong" | "weak" | "none";

export type AshbyQuestionClass =
  | "identity"
  | "contact"
  | "link"
  | "document"
  | "work_auth"
  | "location"
  | "consent"
  | "demographic"
  | "long_form"
  | "custom_bespoke";

export type AshbyAnswerabilityClass =
  | "safe_known"
  | "derived_profile"
  | "organization_scoped"
  | "user_truth_required"
  | "custom_bespoke";

export type AshbyAnswerSource =
  | "profile"
  | "derived"
  | "cache"
  | "approved_answer"
  | "llm_best_attempt"
  | "default"
  | "review"
  | "missing";

export type AshbyFillStatus =
  | "filled"
  | "skipped"
  | "missing"
  | "failed"
  | "blocked";

export type AshbyBlockerKind =
  | "missing_required_answer"
  | "profile_preflight_missing"
  | "unsupported_required_field"
  | "fill_verification_failed"
  | "submit_control_missing"
  | "submit_confirmation_missing"
  | "unexpected_verification_gate"
  | "validation_error";

export type AshbyOutcomeClass =
  | "confirmed"
  | "rejected_validation"
  | "rejected_spam"
  | "ambiguous"
  | "unsupported_gate"
  | "blocked_before_submit";

export type AshbyFieldObservation = {
  label: string | null;
  question_text: string | null;
  normalized_prompt: string | null;
  prompt_hash: string | null;
  required: boolean;
  control_kind: AshbyControlKind;
  selector_hint: string | null;
  options: string[];
  option_signature: string | null;
  section: string | null;
  supported: boolean;
  validation_state: AshbyValidationState;
  tag: string;
  input_type: string | null;
  name: string | null;
  id: string | null;
  placeholder: string | null;
  multiple: boolean;
};

export type AshbySourceControl = {
  selector: string | null;
  control_kind: AshbyControlKind;
  label: string | null;
  name: string | null;
  id: string | null;
};

export type AshbyQuestionNode = {
  question_text: string;
  normalized_prompt: string;
  prompt_hash: string;
  widget_family: AshbyWidgetFamily;
  control_kind: AshbyControlKind;
  options: string[];
  option_signature: string | null;
  required: boolean;
  section_path: string[];
  helper_copy: string[];
  validation_state: AshbyValidationState;
  source_controls: AshbySourceControl[];
  primary_selector: string | null;
  representative_field: AshbyFieldObservation;
};

export type AshbyFormSnapshot = {
  url: string | null;
  title: string | null;
  body_text_sample: string;
  fields: AshbyFieldObservation[];
  questions: AshbyQuestionNode[];
  validation_errors: string[];
  confirmation_texts: string[];
  submit_controls: number;
  unexpected_verification_gate: boolean;
  notes: string[];
};

export type AshbyPromptAlias = {
  provider: "ashby";
  scopeKind: "global" | "organization";
  scopeValue: string;
  promptHash: string;
  normalizedPrompt: string;
  controlKind: AshbyControlKind;
  optionSignature: string | null;
  canonicalKey: string;
  confidence: AshbyMatchConfidence;
  source: string;
  approved: boolean;
};

export type AshbyApprovedAnswer = {
  provider: "ashby";
  scopeKind: "global" | "organization";
  scopeValue: string;
  canonicalKey: string;
  promptHash: string | null;
  answerValue: string;
  answerKind: "text" | "choice" | "file";
  source: string;
  approved: boolean;
};

export type AshbyResolvedAnswer = {
  canonical_key: string;
  source: AshbyAnswerSource;
  source_detail: string | null;
  value: string | null;
  present: boolean;
  blocking_if_missing: boolean;
  field_label: string | null;
  selector: string | null;
  confidence: AshbyMatchConfidence;
  scope_kind: "global" | "organization" | null;
  scope_value: string | null;
  approved: boolean;
  review_status?: "not_required" | "pending_review" | "post_submit_review";
};

export type AshbyDraftAnswerMode = "review_only" | "fill";
export type AshbyPreflightMode = "block_before_fill" | "collect_without_submit";

export type AshbyDraftAnswer = {
  provider: "ashby";
  promptHash: string;
  questionText: string;
  normalizedPrompt: string;
  answerValue: string;
  answerKind: "text" | "choice";
  confidence: AshbyMatchConfidence;
  source: "llm";
  sourceDetail: string | null;
  rationale: string | null;
  evidence: string[];
  requiresReview: boolean;
  reviewStatus: "pending_review" | "post_submit_review";
};

export type AshbyProfilePreflightIssue = {
  canonicalKey: string;
  label: string | null;
  reason: string;
  selector: string | null;
};

export type AshbyFillOperation = {
  key: string;
  status: AshbyFillStatus;
  selector: string | null;
  detail: string | null;
  verified: boolean;
  blocking: boolean;
};

export type AshbyBlocker = {
  kind: AshbyBlockerKind;
  key: string;
  label: string | null;
  detail: string;
  selector: string | null;
};

export type AshbyMappingDecision = {
  prompt_hash: string;
  question_text: string;
  canonical_key: string | null;
  confidence: AshbyMatchConfidence;
  source: "cache" | "library" | "heuristic" | "llm" | "none";
  question_class: AshbyQuestionClass;
  answerability_class: AshbyAnswerabilityClass;
  auto_accepted: boolean;
  rationale: string | null;
};

export type AshbyReviewItem = {
  organization_slug: string | null;
  prompt_hash: string;
  question_text: string;
  normalized_prompt: string;
  control_kind: AshbyControlKind;
  widget_family: AshbyWidgetFamily;
  question_class: AshbyQuestionClass;
  answerability_class: AshbyAnswerabilityClass;
  options: string[];
  helper_copy: string[];
  section_path: string[];
  canonical_key_candidate: string | null;
  answer_candidate: string | null;
  confidence: AshbyMatchConfidence;
  source: AshbyAnswerSource | "matcher";
  reason: string;
  selector: string | null;
  scope_kind: "global" | "organization";
  scope_value: string | null;
};

export type AshbyFillTarget = {
  question: AshbyQuestionNode;
  field: AshbyFieldObservation;
  canonical_key: string;
  answer: AshbyResolvedAnswer;
  value: string;
  option_candidates: string[];
  fill_order: number;
  answer_kind: "text" | "choice" | "file";
};

export type AshbyResolutionPlan = {
  resolved_answers: AshbyResolvedAnswer[];
  mapping_decisions: AshbyMappingDecision[];
  fill_targets: AshbyFillTarget[];
  missing_required: AshbyBlocker[];
  unsupported_required: AshbyBlocker[];
  pending_review: AshbyReviewItem[];
  needs_user_answers: AshbyProfilePreflightIssue[];
  cached_alias_hits: number;
  cached_answer_hits: number;
};

export type AshbyRunGrade = {
  discovered_question_count: number;
  required_question_count: number;
  mapped_question_count: number;
  deterministic_match_count: number;
  cache_hit_count: number;
  llm_match_count: number;
  auto_accepted_count: number;
  unresolved_blocking_count: number;
  verification_failure_count: number;
  submit_ready: boolean;
};

export type AshbySubmissionEvidence = {
  outcome: AshbyOutcomeClass;
  details: string[];
  url: string | null;
};
