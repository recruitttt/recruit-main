import type {
  AshbyBlocker,
  AshbyFieldObservation,
  AshbyFillOperation,
  AshbyFormSnapshot,
  AshbyOutcomeClass,
  AshbyQuestionNode,
  AshbyResolutionPlan,
  AshbySubmissionEvidence,
} from "../ashby-fill/types";
import type { buildRunGrade } from "../ashby-fill/core";

export type LeverFieldObservation = AshbyFieldObservation & {
  card_id: string | null;
  card_field_index: number | null;
  provider_key: string | null;
};

export type LeverQuestionNode = AshbyQuestionNode;

export type LeverCaptchaKind = "hcaptcha" | "recaptcha" | "turnstile" | "unknown";

export type LeverCaptchaGate = {
  present: boolean;
  kinds: LeverCaptchaKind[];
  primary: LeverCaptchaKind | null;
  tokenSelectors: string[];
  tokenValueLengths: number[];
  frameCount: number;
  supportedByBrowserbase: boolean;
  unsupportedReason: string | null;
};

export type LeverFormSnapshot = Omit<AshbyFormSnapshot, "fields" | "questions"> & {
  provider: "lever";
  company_slug: string | null;
  posting_id: string | null;
  hcaptcha_present: boolean;
  captcha: LeverCaptchaGate;
  fields: LeverFieldObservation[];
  questions: LeverQuestionNode[];
};

export type LeverBaseTemplateField = {
  type: string;
  text: string;
  description: string;
  required: boolean;
  id: string | null;
  options: string[];
};

export type LeverBaseTemplate = {
  id: string | null;
  text: string;
  fields: LeverBaseTemplateField[];
};

export type LeverFormFillResult = {
  provider: "lever";
  targetUrl: string;
  finalUrl: string | null;
  companySlug: string;
  postingId: string;
  submitAttempted: boolean;
  submitCompleted: boolean;
  outcome: AshbyOutcomeClass;
  submissionEvidence: AshbySubmissionEvidence;
  plan: AshbyResolutionPlan;
  fillOperations: AshbyFillOperation[];
  blockers: AshbyBlocker[];
  needsUserAnswers: Array<{
    canonicalKey: string;
    label: string | null;
    reason: string;
    selector: string | null;
  }>;
  preUploadSnapshot: LeverFormSnapshot;
  postUploadSnapshot: LeverFormSnapshot;
  finalSnapshot: LeverFormSnapshot;
  runGrade: ReturnType<typeof buildRunGrade>;
  screenshots: Array<{ label: string; captured: boolean; byteLength?: number; error?: string }>;
  notes: string[];
  errors: Array<{ where: string; message: string }>;
};
