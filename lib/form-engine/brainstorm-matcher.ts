import type { BrainstormedAnswer } from "./types";

export function findBrainstormedAnswer(
  questionText: string,
  brainstormedAnswers: BrainstormedAnswer[] | undefined,
): string | null {
  if (!brainstormedAnswers?.length) return null;
  const t = questionText.toLowerCase();
  for (const ba of brainstormedAnswers) {
    if (questionMatches(ba.questionType, t)) return ba.answer;
  }
  return null;
}

function questionMatches(qType: string, qTextLower: string): boolean {
  if (qType === "why_this_company") return qTextLower.includes("why") && (qTextLower.includes("company") || qTextLower.includes("us") || qTextLower.includes("here"));
  if (qType === "biggest_challenge") return qTextLower.includes("challenge") || qTextLower.includes("difficult") || qTextLower.includes("obstacle");
  if (qType === "leadership_example") return qTextLower.includes("leadership") || qTextLower.includes("led a") || qTextLower.includes("led the");
  if (qType === "tell_me_about_yourself") return qTextLower.includes("about yourself") || qTextLower.includes("introduce yourself") || qTextLower.includes("background");
  if (qType === "weakness") return qTextLower.includes("weakness") || qTextLower.includes("improve");
  if (qType === "strength") return qTextLower.includes("strength") || qTextLower.includes("strongest");
  if (qType === "team_conflict") return qTextLower.includes("conflict") || qTextLower.includes("disagreement");
  return false;
}
