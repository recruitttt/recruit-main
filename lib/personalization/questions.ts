import type { PersonalizationQuestion, QuestionCategory } from "./types";

export const QUESTIONS: PersonalizationQuestion[] = [
  { id: "cg_1", category: "career_goals", text: "Where do you want to be in three years?" },
  { id: "cg_2", category: "career_goals", text: "What kind of role do you want next, and why?" },
  { id: "we_1", category: "work_environment", text: "Do you thrive in fast-paced or methodical environments?" },
  { id: "we_2", category: "work_environment", text: "Remote, hybrid, or in-office — and what makes the difference?" },
  { id: "we_3", category: "work_environment", text: "Smaller team or larger org — what fits you better right now?" },
  { id: "mt_1", category: "motivations", text: "What's been the strongest driver in your career so far?" },
  { id: "mt_2", category: "motivations", text: "When you've felt most engaged at work, what was happening?" },
  { id: "cs_1", category: "communication_style", text: "How do you like to give and receive feedback?" },
  { id: "cs_2", category: "communication_style", text: "Are you more of a direct communicator or do you prefer to build context first?" },
  { id: "vl_1", category: "values", text: "What's a non-negotiable for your next role?" },
  { id: "vl_2", category: "values", text: "What kind of company values do you align with?" },
  { id: "st_1", category: "stories", text: "Tell me about a project you're proud of." },
  { id: "st_2", category: "stories", text: "Describe a time you led a team through ambiguity." },
  { id: "st_3", category: "stories", text: "What's a hard problem you solved recently?" },
];

export function pickNextQuestion(answeredIds: string[], gaps: QuestionCategory[]): PersonalizationQuestion | null {
  const unanswered = QUESTIONS.filter(q => !answeredIds.includes(q.id));
  if (unanswered.length === 0) return null;
  const prioritized = unanswered.filter(q => gaps.includes(q.category));
  const pool = prioritized.length > 0 ? prioritized : unanswered;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function gapsFromPersonalization(p: {
  careerGoals?: string;
  workEnvironment?: { remote?: boolean; teamSize?: string; pace?: string };
  motivations?: string[];
  communicationStyle?: string;
  valuesAlignment?: string[];
  storyFragments?: Array<{ topic: string; story: string }>;
} | undefined): QuestionCategory[] {
  if (!p) return ["career_goals", "work_environment", "motivations", "communication_style", "values", "stories"];
  const gaps: QuestionCategory[] = [];
  if (!p.careerGoals) gaps.push("career_goals");
  if (!p.workEnvironment) gaps.push("work_environment");
  if (!p.motivations || p.motivations.length === 0) gaps.push("motivations");
  if (!p.communicationStyle) gaps.push("communication_style");
  if (!p.valuesAlignment || p.valuesAlignment.length === 0) gaps.push("values");
  if (!p.storyFragments || p.storyFragments.length < 2) gaps.push("stories");
  return gaps;
}
