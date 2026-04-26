import OpenAI from "openai";
import type { ExtractedInsight, QuestionCategory } from "./types";

const EXTRACTION_PROMPT = `Extract structured personalization insight from the user's answer.

Question category: {{CATEGORY}}
Question: {{QUESTION}}
Answer: {{ANSWER}}

Return JSON matching one of these patterns based on category:
- "career_goals": {"field": "careerGoals", "value": "<string>"}
- "work_environment": {"field": "workEnvironment", "value": {"remote": <bool|null>, "teamSize": "<string|null>", "pace": "<string|null>"}}
- "motivations": {"field": "motivations", "value": ["<string>", ...]}
- "communication_style": {"field": "communicationStyle", "value": "<string>"}
- "values": {"field": "valuesAlignment", "value": ["<string>", ...]}
- "stories": {"field": "storyFragments", "value": {"topic": "<short>", "story": "<the story in user's voice>"}}

Return only the JSON.`;

export async function extractInsight(
  client: OpenAI,
  category: QuestionCategory,
  question: string,
  answer: string,
): Promise<ExtractedInsight | null> {
  const prompt = EXTRACTION_PROMPT
    .replace("{{CATEGORY}}", category)
    .replace("{{QUESTION}}", question)
    .replace("{{ANSWER}}", answer);
  const res = await client.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { field: string; value: unknown };
    if (!parsed.field || parsed.value === undefined || parsed.value === null) return null;
    return { category, field: parsed.field, value: parsed.value as ExtractedInsight["value"] };
  } catch {
    return null;
  }
}
