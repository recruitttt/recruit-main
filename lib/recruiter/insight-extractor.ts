import OpenAI from "openai";
import type { BrainstormedAnswer } from "./types";

const EXTRACTION_PROMPT = `Given the following recruiter ↔ candidate conversation exchange, identify if the candidate produced an answer to a common application question (e.g., "why this company", "biggest challenge", "leadership example", "tell me about yourself", "weakness", "strengths", "team conflict").

If yes, return JSON:
{"questionType": "<short_snake_case_label>", "answer": "<the candidate's answer in their voice, 50-200 words>"}

If no, return: {"questionType": null}

Only return the JSON object. No prose.

EXCHANGE:
RECRUITER: {{RECRUITER}}
CANDIDATE: {{CANDIDATE}}`;

export async function extractBrainstormedAnswer(
  client: OpenAI,
  recruiterMessage: string,
  candidateMessage: string,
): Promise<BrainstormedAnswer | null> {
  const prompt = EXTRACTION_PROMPT
    .replace("{{RECRUITER}}", recruiterMessage)
    .replace("{{CANDIDATE}}", candidateMessage);
  const res = await client.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { questionType: string | null; answer?: string };
    if (!parsed.questionType || !parsed.answer) return null;
    return {
      questionType: parsed.questionType,
      answer: parsed.answer,
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
