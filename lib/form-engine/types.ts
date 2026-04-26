export type ApplicationJobStatus =
  | "queued"
  | "claimed"
  | "browser_started"
  | "form_discovered"
  | "answers_resolved"
  | "fill_in_progress"
  | "filled_verified"
  | "waiting_for_user_input"
  | "submit_attempted"
  | "submitted_confirmed"
  | "submitted_probable"
  | "failed_repairable"
  | "failed_user_input_required"
  | "failed_unsupported_widget"
  | "failed_auth_required"
  | "failed_captcha_or_bot_challenge"
  | "failed_browser_crash"
  | "failed_network"
  | "duplicate_or_already_applied"
  | "archived";

export type SubmitPolicy = "dry_run" | "submit";
export type LlmMode = "off" | "review_only" | "best_effort";
export type FormProvider = "ashby" | "greenhouse" | "lever" | "workday" | "generic";

export type SemanticClass =
  | "identity"
  | "contact"
  | "resume"
  | "work_authorization"
  | "sponsorship"
  | "location"
  | "compensation"
  | "start_date"
  | "demographic"
  | "legal"
  | "consent"
  | "custom"
  | "unknown";

export type QuestionSensitivity =
  | "safe_profile_fact"
  | "user_preference"
  | "hard_truth"
  | "legal_sensitive"
  | "demographic_sensitive"
  | "llm_allowed_custom"
  | "unsupported";

export type ControlType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "combobox"
  | "radio"
  | "checkbox"
  | "multi_checkbox"
  | "file"
  | "rich_text"
  | "autocomplete"
  | "unknown";

export type LocatorStrategy = {
  kind: "css" | "role" | "label" | "placeholder" | "text" | "provider";
  value: string;
  name?: string;
};

export type RequiredInference = {
  value: boolean;
  confidence: number;
  evidence: string[];
};

export type OptionDescriptor = {
  id: string;
  label: string;
  value: string | null;
  selector?: string | null;
  confidence: number;
};

export type QuestionIR = {
  id: string;
  rawPrompt: string;
  normalizedPrompt: string;
  semanticClass: SemanticClass;
  required: RequiredInference;
  sensitivity: QuestionSensitivity;
  options: string[];
  providerKey?: string | null;
  evidence: string[];
};

export type ControlDescriptor = {
  id: string;
  questionId: string;
  type: ControlType;
  selector?: string | null;
  locatorStrategy: LocatorStrategy;
  framePath?: string[];
  shadowPath?: string[];
  currentValue?: unknown;
  optionNodes?: OptionDescriptor[];
  validationHint?: string | null;
  confidence: number;
};

export type NetworkHint = {
  kind: "schema" | "submit_request" | "validation_response" | "confirmation_response";
  method?: string;
  url?: string;
  status?: number;
  payload?: unknown;
};

export type FormIR = {
  provider: FormProvider;
  targetUrl: string;
  finalUrl?: string | null;
  jobMetadata?: {
    company?: string | null;
    title?: string | null;
    providerJobId?: string | null;
  };
  questions: QuestionIR[];
  controls: ControlDescriptor[];
  networkHints: NetworkHint[];
  evidence: string[];
};

export type AnswerDecisionStatus =
  | "resolved"
  | "missing_required"
  | "blocked_hard_truth"
  | "blocked_sensitive"
  | "llm_allowed"
  | "user_input_required";

export type AnswerSource =
  | "profile"
  | "approved_answer_cache"
  | "provider_history"
  | "manual_user_answer"
  | "llm"
  | "default"
  | "missing";

export type AnswerDecision = {
  questionId: string;
  status: AnswerDecisionStatus;
  value?: unknown;
  source: AnswerSource;
  confidence: number;
  maySubmit: boolean;
  reason?: string;
};

export type FillStep = {
  question: QuestionIR;
  control: ControlDescriptor;
  answer: AnswerDecision;
  required: boolean;
};

export type FillPlan = {
  steps: FillStep[];
  unresolved: AnswerDecision[];
  maySubmit: boolean;
};

export type VerificationResult = {
  ok: boolean;
  observedValue?: unknown;
  strategy: string;
  reason?: string;
};

export type FillResult = {
  questionId: string;
  controlId: string;
  status: "filled" | "skipped" | "failed" | "blocked";
  strategyUsed: string;
  verification: VerificationResult;
  required: boolean;
  error?: string;
};

export type ValidationRepairPlan = {
  validationLabels: string[];
  targetQuestionIds: string[];
  repairLimit: number;
  attempt: number;
};

export type SubmissionOutcome =
  | "confirmed"
  | "likely_submitted"
  | "needs_human_review"
  | "failed"
  | "duplicate_or_already_applied";

export type EvidenceBundle = {
  finalUrl?: string | null;
  successText?: string[];
  validationErrors?: string[];
  submitResponseStatus?: number;
  applicationId?: string | null;
  screenshotRefs?: Array<{ label: string; url?: string; byteLength?: number }>;
  browserSessionId?: string | null;
  liveViewUrl?: string | null;
  recordingUrl?: string | null;
  notes?: string[];
  raw?: unknown;
};

export type SubmissionResult = {
  status: SubmissionOutcome;
  provider: FormProvider;
  confidence: number;
  submitAttempted: boolean;
  submitCompleted: boolean;
  evidence: EvidenceBundle;
  failureCategory?: ApplicationJobStatus;
};

export type ApplicationJobInput = {
  id?: string;
  demoUserId: string;
  profileId?: string | null;
  providerHint?: FormProvider | null;
  provider?: FormProvider | null;
  jobId?: string | null;
  targetUrl: string;
  canonicalTargetUrl: string;
  company?: string | null;
  title?: string | null;
  submitPolicy: SubmitPolicy;
  llmMode: LlmMode;
  repairLimit: number;
  idempotencyKey: string;
};

export type ProviderAdapter<TPage = unknown> = {
  provider: FormProvider;
  detectProvider(page: TPage, url: string): Promise<boolean> | boolean;
  inspectPage(page: TPage): Promise<{ kind: "form" | "submitted" | "already_applied" | "blocked"; reason?: string }>;
  discoverForm(page: TPage): Promise<FormIR>;
  collectValidationErrors(page: TPage): Promise<string[]>;
  nextAction(page: TPage): Promise<{ kind: "next" | "submit" | "blocked"; selector?: string; reason?: string }>;
  submitAndConfirm(page: TPage): Promise<SubmissionResult>;
};
