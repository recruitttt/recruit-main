export type ApplyMode = "manual" | "auto-strict" | "auto-aggressive" | "hands-free";

export type ComputerUseModel = "gpt-5.4-nano" | "gpt-5.4-mini" | "claude-sonnet-4-6";

export type ApplyJobStatus =
  | "queued"
  | "tailoring"
  | "filling"
  | "questions_ready"
  | "review_ready"
  | "submit_queued"
  | "submitted_dev"
  | "submitted"
  | "manual_finish_required"
  | "failed"
  | "cancelled";

export type ApplyRunStatus =
  | "queued"
  | "tailoring"
  | "filling"
  | "questions_ready"
  | "review_ready"
  | "submitting"
  | "completed"
  | "failed"
  | "cancelled";

export type ApplyServiceSettings = {
  maxApplicationsPerRun: number;
  maxConcurrentApplications: number;
  maxConcurrentPerDomain: number;
  mode: ApplyMode;
  computerUseModel: ComputerUseModel;
  devSkipRealSubmit: boolean;
};

export type JobCandidate = {
  id: string;
  company: string;
  title: string;
  url: string;
  applicationUrl?: string;
  location?: string;
  source?: string;
  description?: string;
  requirements?: string[];
};

export type ShortlistResult = {
  job: JobCandidate;
  score: number;
  rationale: string;
  strengths: string[];
  risks: string[];
};

export type TailoredResume = {
  jobId: string;
  filename: string;
  path?: string;
  base64?: string;
  byteLength?: number;
  source?: "convex" | "browser" | "generated" | "manual";
};

export type ApplyServiceProfile = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  links?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    website?: string;
    personalWebsite?: string;
    googleScholar?: string;
    [key: string]: string | undefined;
  };
  workAuthorization?: {
    citizenship?: string[];
    authorizedToWorkUS?: boolean;
    requiresSponsorshipNow?: boolean;
    requiresSponsorshipFuture?: boolean;
    visaType?: string;
  };
  skills?: string[];
  preferences?: {
    roles?: string[];
    locations?: string[];
    primaryProgrammingLanguage?: string;
    programmingLanguages?: Array<{
      language: string;
      proficiency?: string;
      years?: string;
    }>;
  };
  prefs?: {
    roles?: string[];
    locations?: string[];
    workAuth?: string;
    minSalary?: string;
  };
  experience?: Array<{
    company?: string;
    title?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    school?: string;
    institution?: string;
    degree?: string;
    field?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string | number;
  }>;
  resume?: {
    filename?: string;
    rawText?: string;
    uploadedAt?: string;
  };
};

export type NormalizedApplyBatch = {
  jobs: JobCandidate[];
  profile: ApplyServiceProfile;
  tailoredResumes: Record<string, TailoredResume>;
  settings: ApplyServiceSettings;
  consent: {
    externalTargetsApproved: boolean;
    finalSubmitApproved?: boolean;
  };
};

export type NormalizedApplyBatchResult =
  | { ok: true; value: NormalizedApplyBatch }
  | {
      ok: false;
      reason: string;
      status: number;
      maxApplicationsPerRun?: number;
    };

export type DeferredQuestion = {
  id: string;
  jobId: string;
  jobTitle?: string;
  company?: string;
  prompt: string;
  provisionalAnswer: string;
  confidence: number;
  category?: string;
  options?: string[];
  screenshotPng?: string;
  field?: {
    label?: string;
    selector?: string;
    fieldId?: string;
  };
};

export type DeferredQuestionGroup = {
  id: string;
  semanticKey: string;
  prompt: string;
  status: "pending" | "resolved";
  provisionalAnswer: string;
  answer?: string;
  remember?: boolean;
  requiresExplicitGate: boolean;
  items: DeferredQuestion[];
};

export type ApplicationReviewItem = {
  id: string;
  jobId: string;
  label: string;
  value: string;
  kind: "creative" | "legal" | "low_confidence" | "final_submit";
  field?: DeferredQuestion["field"];
  screenshotPng?: string;
};

export type ApplyEvent = {
  id: string;
  runId: string;
  jobId?: string;
  kind:
    | "run_created"
    | "job_queued"
    | "job_started"
    | "tailored_resume_ready"
    | "recruit2_run_started"
    | "field_progress"
    | "deferred_question_recorded"
    | "batch_questions_ready"
    | "batch_questions_resolved"
    | "review_ready"
    | "submit_approved"
    | "job_cancelled"
    | "job_failed";
  message: string;
  createdAt: string;
  payload?: unknown;
};

export type ApplyJob = {
  id: string;
  job: JobCandidate;
  status: ApplyJobStatus;
  tailoredResume?: TailoredResume;
  remoteJobSlug?: string;
  remoteRunId?: string;
  liveViewUrl?: string;
  screenshotPng?: string;
  reviewItems: ApplicationReviewItem[];
  error?: string;
  updatedAt: string;
};

export type ApplyRun = {
  id: string;
  status: ApplyRunStatus;
  source: "mock" | "recruit2-api";
  jobs: ApplyJob[];
  settings: ApplyServiceSettings;
  questionGroups: DeferredQuestionGroup[];
  events: ApplyEvent[];
  remoteRunId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Recruit2ApplyPayload = {
  targets: Array<{
    kind: "external";
    url: string;
    company?: string;
    title?: string;
    mode: ApplyMode;
    approval: { externalTargetApproved: true };
  }>;
  profile: Record<string, unknown>;
  settings: {
    defaultMode: ApplyMode;
    maxApplicationsPerRun: number;
    maxConcurrentApplications: number;
    maxConcurrentPerDomain: number;
    computerUseModel: ComputerUseModel;
    fillerModel: ComputerUseModel;
    liaisonModel: "gpt-5.4-nano";
    reviewerModel: "gpt-5.4-nano";
    autoSubmit: boolean;
  };
};
