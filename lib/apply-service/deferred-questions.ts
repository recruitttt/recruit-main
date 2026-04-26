import type { DeferredQuestion, DeferredQuestionGroup } from "./types";

export function groupDeferredQuestions(questions: DeferredQuestion[]): DeferredQuestionGroup[] {
  const groups = new Map<string, DeferredQuestionGroup>();
  for (const question of questions) {
    const semanticKey = semanticQuestionKey(question);
    const existing = groups.get(semanticKey);
    if (existing) {
      existing.items.push(question);
      existing.provisionalAnswer = chooseBestProvisional(existing.provisionalAnswer, question.provisionalAnswer);
      continue;
    }
    groups.set(semanticKey, {
      id: semanticKey,
      semanticKey,
      prompt: canonicalPrompt(question, semanticKey),
      status: "pending",
      provisionalAnswer: question.provisionalAnswer,
      requiresExplicitGate: requiresExplicitGate(question, semanticKey),
      items: [question],
    });
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.requiresExplicitGate !== b.requiresExplicitGate) return a.requiresExplicitGate ? 1 : -1;
    return a.semanticKey.localeCompare(b.semanticKey);
  });
}

export function semanticQuestionKey(question: DeferredQuestion): string {
  const category = normalize(question.category ?? "");
  const prompt = normalize(question.prompt);
  if (category.includes("primary_programming_language") || category === "programming_language") {
    return "primary_programming_language";
  }
  if (/main development language|most fluent.*programming|programming language|primary language/.test(prompt)) {
    return "primary_programming_language";
  }
  if (category.includes("preferred_location") || /preferred.*location|where.*work|work location/.test(prompt)) {
    return "preferred_location";
  }
  if (category.includes("how_heard") || /how did you hear|how have you heard|heard about/.test(prompt)) {
    return "how_heard";
  }
  if (category.includes("work_style") || /remote|hybrid|onsite|work style/.test(prompt)) {
    return "work_style";
  }
  if (category.includes("legal") || /certify|accurate|true and complete|terms|privacy/.test(prompt)) {
    return "legal_certification";
  }
  return `custom_${prompt.slice(0, 80).replace(/\s+/g, "_") || question.id}`;
}

function canonicalPrompt(question: DeferredQuestion, key: string): string {
  if (key === "primary_programming_language") {
    return "What primary programming language should Recruit use for jobs that ask this question?";
  }
  if (key === "preferred_location") {
    return "What preferred work location should Recruit use for these applications?";
  }
  if (key === "how_heard") {
    return "How should Recruit answer common 'how did you hear about us' questions?";
  }
  if (key === "work_style") {
    return "What work style should Recruit use where these forms ask about remote, hybrid, or onsite preference?";
  }
  if (key === "legal_certification") {
    return "Please review the legal or certification checkbox before submission.";
  }
  return question.prompt;
}

function requiresExplicitGate(question: DeferredQuestion, semanticKey: string): boolean {
  if (semanticKey === "legal_certification") return true;
  const prompt = normalize(question.prompt);
  return /certify|attest|legal|privacy|terms|background check|payment|captcha|verification/.test(prompt);
}

function chooseBestProvisional(current: string, next: string): string {
  if (!current.trim()) return next;
  if (!next.trim()) return current;
  return current.length >= next.length ? current : next;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
