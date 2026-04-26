import type { QuestionIR } from "./types";

export function extractMissingRequiredLabels(validationErrors: string[]): string[] {
  const labels: string[] = [];
  for (const error of validationErrors) {
    const regex = /Missing entry for required field:\s*([^|]+?)(?=Missing entry for required field:|Personal Information|Application questions|Submit Application|$)/gi;
    for (const match of error.matchAll(regex)) {
      const label = (match[1] ?? "").replace(/\s+/g, " ").trim();
      if (label) labels.push(label);
    }
  }

  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizeFormText(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function validationLabelMatchesQuestion(label: string, question: Pick<QuestionIR, "rawPrompt" | "normalizedPrompt">): boolean {
  const normalizedLabel = normalizeFormText(label);
  const questionText = question.normalizedPrompt || normalizeFormText(question.rawPrompt);
  if (!normalizedLabel || !questionText) return false;
  if (normalizedLabel === questionText) return true;
  if (normalizedLabel.includes(questionText) || questionText.includes(normalizedLabel)) return true;
  const labelTokens = normalizedLabel.split(/\W+/).filter((token) => token.length > 4);
  if (labelTokens.length === 0) return false;
  const hits = labelTokens.filter((token) => questionText.includes(token)).length;
  return hits >= Math.min(2, labelTokens.length);
}

export function normalizeFormText(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
