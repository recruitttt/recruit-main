export type QuestionCategory =
  | "career_goals"
  | "work_environment"
  | "motivations"
  | "communication_style"
  | "values"
  | "stories";

export type PersonalizationQuestion = {
  id: string;
  category: QuestionCategory;
  text: string;
};

export type ExtractedInsight = {
  category: QuestionCategory;
  field: string;
  value: string | string[] | { topic: string; story: string };
};
