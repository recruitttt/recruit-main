import { chatJSON, extractJSONBlock } from "../openai";
import { normalizeAshbyText } from "./core";
import type { AshbyDraftAnswer, AshbyQuestionNode } from "./types";

type DraftResponse = {
  answers?: Array<{
    promptHash?: string;
    prompt_hash?: string;
    answer?: string;
    answer_text?: string;
    confidence?: "none" | "weak" | "strong";
    rationale?: string;
    evidence?: string[];
    sensitive?: boolean;
  }>;
};

const BLOCKED_PROMPT_PATTERNS = [
  "resume",
  "cv/resume",
  "cover letter",
  "phone",
  "contact number",
  "address",
  "salary",
  "compensation",
  "notice period",
  "start date",
  "pick date",
  "date of birth",
  "birth date",
  "dob",
  "age",
  "right to work",
  "authorized",
  "eligible to work",
  "citizen",
  "citizenship",
  "nationality",
  "visa",
  "sponsorship",
  "gender",
  "race",
  "ethnicity",
  "veteran",
  "disability",
  "criminal",
  "conviction",
  "background check",
  "social security",
  "ssn",
];

export async function draftAshbyAnswersWithOpenAI(args: {
  apiKey: string;
  model?: string;
  profile: unknown;
  organizationSlug: string | null;
  questions: AshbyQuestionNode[];
  signal?: AbortSignal;
}): Promise<{ answers: AshbyDraftAnswer[]; errors: string[] }> {
  const questions = args.questions.filter(isOpenAiDraftCandidate).slice(0, 24);
  if (questions.length === 0) return { answers: [], errors: [] };

  const result = await chatJSON(
    args.apiKey,
    [
      {
        role: "system",
        content:
          "You draft short, truthful job application answers from the candidate profile only. " +
          "Return JSON only. Do not invent credentials, employment history, legal/work authorization, salary, dates, phone numbers, or files. " +
          "For non-sensitive scenario, culture, motivation, and skill-self-assessment prompts, make the best grounded attempt from the profile. " +
          "Return exactly one answer object for every provided question unless the question is sensitive. " +
          "If support is indirect, answer with confidence weak instead of omitting. If the profile has direct support, answer with confidence strong.",
      },
      {
        role: "user",
        content: JSON.stringify({
          organizationSlug: args.organizationSlug,
          candidateProfile: compactProfile(args.profile),
          questions: questions.map((question) => ({
            promptHash: question.prompt_hash,
            questionText: question.question_text,
            controlKind: question.control_kind,
            options: question.options,
            required: question.required,
          })),
          outputSchema: {
            answers: [
              {
                promptHash: "string from questions",
                answer: "1-4 sentence answer, or exact option text for choices",
                confidence: "weak|strong",
                evidence: ["profile fields used, such as skills, experience, summary, education, links"],
                sensitive: false,
                rationale: "brief profile-grounding note; do not include private chain of thought",
              },
            ],
          },
        }),
      },
    ],
    { model: args.model ?? "gpt-4o-mini", temperature: 0.2, signal: args.signal }
  );

  if (!result.ok) return { answers: [], errors: [result.reason] };

  try {
    const parsed = JSON.parse(extractJSONBlock(result.raw)) as DraftResponse;
    const byHash = new Map(questions.map((question) => [question.prompt_hash, question]));
    const answers: AshbyDraftAnswer[] = [];
    for (const entry of parsed.answers ?? []) {
      const promptHash = typeof entry.promptHash === "string"
        ? entry.promptHash
        : typeof entry.prompt_hash === "string"
          ? entry.prompt_hash
          : "";
      const question = byHash.get(promptHash);
      const answer = question ? draftAnswerFromEntry(entry, question, args.model) : null;
      if (answer) answers.push(answer);
    }

    const answered = new Set(answers.map((answer) => answer.promptHash));
    for (const question of questions.filter((item) => !answered.has(item.prompt_hash)).slice(0, 24)) {
      const retry = await draftSingleAshbyAnswer({
        apiKey: args.apiKey,
        model: args.model,
        profile: args.profile,
        organizationSlug: args.organizationSlug,
        question,
        signal: args.signal,
      });
      if (retry) answers.push(retry);
    }
    return { answers, errors: [] };
  } catch (error) {
    return { answers: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
}

async function draftSingleAshbyAnswer(args: {
  apiKey: string;
  model?: string;
  profile: unknown;
  organizationSlug: string | null;
  question: AshbyQuestionNode;
  signal?: AbortSignal;
}): Promise<AshbyDraftAnswer | null> {
  const result = await chatJSON(
    args.apiKey,
    [
      {
        role: "system",
        content:
          "Draft one truthful, concise job application answer from the candidate profile only. " +
          "Return JSON only. Do not invent credentials, legal facts, salary, dates, phone numbers, or files. " +
          "For non-sensitive scenario and culture prompts, make the best grounded attempt.",
      },
      {
        role: "user",
        content: JSON.stringify({
          organizationSlug: args.organizationSlug,
          candidateProfile: compactProfile(args.profile),
          question: {
            promptHash: args.question.prompt_hash,
            questionText: args.question.question_text,
            controlKind: args.question.control_kind,
            options: args.question.options,
            required: args.question.required,
          },
          outputSchema: {
            promptHash: args.question.prompt_hash,
            answer: "1-4 sentence answer, or exact option text for choices",
            confidence: "weak|strong",
            evidence: ["profile fields used"],
            sensitive: false,
            rationale: "brief profile-grounding note",
          },
        }),
      },
    ],
    { model: args.model ?? "gpt-4o-mini", temperature: 0.2, signal: args.signal }
  );
  if (!result.ok) return null;
  try {
    const parsed = JSON.parse(extractJSONBlock(result.raw)) as
      | NonNullable<DraftResponse["answers"]>[number]
      | DraftResponse;
    const entry = Array.isArray((parsed as DraftResponse).answers)
      ? (parsed as DraftResponse).answers?.[0]
      : (parsed as NonNullable<DraftResponse["answers"]>[number]);
    return draftAnswerFromEntry(entry, args.question, args.model);
  } catch {
    return null;
  }
}

function draftAnswerFromEntry(
  entry: NonNullable<DraftResponse["answers"]>[number] | undefined,
  question: AshbyQuestionNode,
  model?: string
): AshbyDraftAnswer | null {
  if (!entry) return null;
  const answerValue = typeof entry.answer === "string"
    ? entry.answer.trim()
    : typeof entry.answer_text === "string"
      ? entry.answer_text.trim()
      : "";
  if (!answerValue) return null;
  const evidence = Array.isArray(entry.evidence)
    ? entry.evidence.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];
  const confidence = entry.confidence === "strong" && evidence.length > 0 && entry.sensitive !== true
    ? "strong"
    : "weak";
  return {
    provider: "ashby",
    promptHash: question.prompt_hash,
    questionText: question.question_text,
    normalizedPrompt: question.normalized_prompt,
    answerValue,
    answerKind: question.widget_family === "choice_group" || question.widget_family === "select_like" ? "choice" : "text",
    confidence,
    source: "llm",
    sourceDetail: model ?? "gpt-4o-mini",
    rationale: typeof entry.rationale === "string" ? entry.rationale : null,
    evidence,
    requiresReview: confidence !== "strong",
    reviewStatus: confidence === "strong" ? "post_submit_review" : "pending_review",
  };
}

export function isOpenAiDraftCandidate(question: AshbyQuestionNode): boolean {
  if (!question.required) return false;
  if (!["text_like", "choice_group", "select_like"].includes(question.widget_family)) return false;
  const normalized = normalizeAshbyText(question.question_text);
  if (!normalized || normalized.length < 8) return false;
  return !BLOCKED_PROMPT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function compactProfile(profile: unknown): unknown {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
  const record = profile as Record<string, unknown>;
  return {
    name: record.name,
    headline: record.headline,
    summary: record.summary,
    location: record.location,
    links: record.links,
    skills: record.skills,
    experience: record.experience,
    education: record.education,
    application: record.application,
    essays: record.essays,
    prefs: record.prefs,
    resumeSummary: typeof (record.resume as Record<string, unknown> | undefined)?.rawText === "string"
      ? String((record.resume as Record<string, unknown>).rawText).slice(0, 2500)
      : undefined,
  };
}
