import type {
  AnswerDecision,
  AnswerSource,
  QuestionIR,
  QuestionSensitivity,
  SemanticClass,
} from "./types";

const HARD_TRUTH_PROMPTS = [
  "authorized to work",
  "right to work",
  "work authorization",
  "sponsorship",
  "visa",
  "salary",
  "compensation",
  "notice period",
  "start date",
  "available start",
  "non-compete",
  "criminal",
  "background check",
];

const DEMOGRAPHIC_PROMPTS = [
  "gender",
  "race",
  "ethnicity",
  "veteran",
  "disability",
  "sexual orientation",
];

const LEGAL_PROMPTS = [
  "legal",
  "terms",
  "privacy notice",
  "consent",
  "certify",
  "attest",
  "background",
];

export function classifyQuestionSensitivity(question: Pick<QuestionIR, "semanticClass" | "normalizedPrompt">): QuestionSensitivity {
  const prompt = question.normalizedPrompt;
  if (question.semanticClass === "demographic") return "demographic_sensitive";
  if (question.semanticClass === "legal" || question.semanticClass === "consent") return "legal_sensitive";
  if (
    question.semanticClass === "work_authorization" ||
    question.semanticClass === "sponsorship" ||
    question.semanticClass === "compensation" ||
    question.semanticClass === "start_date"
  ) {
    return "hard_truth";
  }
  if (question.semanticClass === "identity" || question.semanticClass === "contact" || question.semanticClass === "resume") {
    return "safe_profile_fact";
  }
  if (question.semanticClass === "location") return "user_preference";
  if (containsAny(prompt, DEMOGRAPHIC_PROMPTS)) return "demographic_sensitive";
  if (containsAny(prompt, HARD_TRUTH_PROMPTS)) return "hard_truth";
  if (containsAny(prompt, LEGAL_PROMPTS)) return "legal_sensitive";
  if (question.semanticClass === "custom") return "llm_allowed_custom";
  return "unsupported";
}

export function inferSemanticClass(normalizedPrompt: string, providerKey?: string | null): SemanticClass {
  const prompt = `${normalizedPrompt} ${providerKey ?? ""}`;
  if (containsAny(prompt, ["resume", "cv"])) return "resume";
  if (containsAny(prompt, ["first name", "last name", "full name", "name"])) return "identity";
  if (containsAny(prompt, ["email", "phone", "contact number", "linkedin", "github", "website"])) return "contact";
  if (containsAny(prompt, ["authorized to work", "right to work"])) return "work_authorization";
  if (containsAny(prompt, ["sponsorship", "visa"])) return "sponsorship";
  if (containsAny(prompt, ["location", "relocate", "commute", "remote", "hybrid"])) return "location";
  if (containsAny(prompt, ["salary", "compensation"])) return "compensation";
  if (containsAny(prompt, ["start date", "notice period", "available start"])) return "start_date";
  if (containsAny(prompt, DEMOGRAPHIC_PROMPTS)) return "demographic";
  if (containsAny(prompt, ["privacy", "consent", "terms", "certify", "legal"])) return "legal";
  return "custom";
}

export function buildAnswerDecision(args: {
  question: QuestionIR;
  value: unknown;
  source: AnswerSource;
  confidence?: number;
}): AnswerDecision {
  const confidence = args.confidence ?? (args.value == null || args.value === "" ? 0 : 0.85);
  const hasValue = args.value !== null && args.value !== undefined && String(args.value).trim() !== "";
  const sensitivity = args.question.sensitivity;

  if (!hasValue) {
    return {
      questionId: args.question.id,
      status: args.question.required.value ? "missing_required" : "user_input_required",
      source: "missing",
      confidence: 0,
      maySubmit: !args.question.required.value,
      reason: "answer missing",
    };
  }

  if (args.source === "llm" && sensitivity !== "llm_allowed_custom") {
    return {
      questionId: args.question.id,
      status: sensitivity === "hard_truth" ? "blocked_hard_truth" : "blocked_sensitive",
      value: args.value,
      source: args.source,
      confidence,
      maySubmit: false,
      reason: `llm answer blocked for ${sensitivity}`,
    };
  }

  if ((sensitivity === "hard_truth" || sensitivity === "legal_sensitive" || sensitivity === "demographic_sensitive") && args.source === "missing") {
    return {
      questionId: args.question.id,
      status: "user_input_required",
      source: "missing",
      confidence: 0,
      maySubmit: false,
      reason: `${sensitivity} requires profile, approved cache, or user input`,
    };
  }

  return {
    questionId: args.question.id,
    status: args.source === "llm" ? "llm_allowed" : "resolved",
    value: args.value,
    source: args.source,
    confidence,
    maySubmit: true,
  };
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}
