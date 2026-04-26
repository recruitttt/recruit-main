import { generateText, type LanguageModel } from "ai";
import { z } from "zod";

export interface GenerateValidatedJsonInput<T> {
  model: LanguageModel;
  system: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  maxRetries?: number;
  schemaHint?: string;
}

export class JsonGenerationError extends Error {
  constructor(message: string, public readonly modelOutput?: string) {
    super(message);
    this.name = "JsonGenerationError";
  }
}

export async function generateValidatedJson<T>(input: GenerateValidatedJsonInput<T>): Promise<{ value: T; modelOutput: string }> {
  const maxRetries = input.maxRetries ?? 2;
  const schemaHint = input.schemaHint ?? "";
  let lastError: Error | undefined;
  let lastOutput = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const correction = lastError && attempt > 0
      ? `\n\nYour previous response failed JSON parsing or schema validation with: ${lastError.message.slice(0, 240)}\nFix it and respond with ONLY valid JSON this time.`
      : "";
    const fullPrompt = [
      input.prompt,
      schemaHint ? `\n\nReturn JSON matching this shape:\n${schemaHint}` : "",
      "\n\nIMPORTANT: Reply with ONE single JSON object. No prose. No markdown fences. Begin with { and end with }.",
      correction,
    ].join("");

    const result = await generateText({
      model: input.model,
      system: input.system,
      prompt: fullPrompt,
    });
    lastOutput = result.text.trim();
    const jsonText = extractJsonObject(lastOutput);
    try {
      const parsed = JSON.parse(jsonText);
      const validated = input.schema.parse(parsed);
      return { value: validated, modelOutput: lastOutput };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new JsonGenerationError(
    `Failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}. Model said: ${lastOutput.slice(0, 400)}`,
    lastOutput,
  );
}

function extractJsonObject(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}
