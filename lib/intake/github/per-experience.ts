import type { LinkedInExperience } from "@/lib/intake/linkedin";
import { generateValidatedJson } from "./json";
import { pickModel, type AICredentials } from "./models";
import { EXPERIENCE_SCHEMA_HINT, ExperienceSummarySchema, type ExperienceSummary } from "./types";

const SYSTEM_PROMPT =
  "You are a senior engineering hiring manager extracting structured signal from a single line of work experience. You only describe what the data actually supports.";

export interface SummarizeExperienceInput {
  experience: LinkedInExperience;
  credentials: AICredentials;
}

export async function summarizeExperience({
  experience,
  credentials,
}: SummarizeExperienceInput): Promise<ExperienceSummary> {
  const position = experience.position_title ?? "(unknown)";
  const company = experience.company ?? "(unknown)";
  const dates = `${experience.from_date ?? "?"} – ${experience.to_date ?? "Present"}`;
  const description = experience.description ?? "(no description)";

  const prompt = [
    `Analyze this single LinkedIn work-experience entry.`,
    ``,
    `Position: ${position}`,
    `Company: ${company}`,
    `Dates: ${dates}`,
    `Location: ${experience.location ?? "(none)"}`,
    ``,
    `Description (verbatim from LinkedIn):`,
    "```",
    description,
    "```",
    ``,
    `Extract structured signal. Be conservative — if the description is empty/thin, return short or empty arrays.`,
    `- roleSummary: 1-2 sentences on what they did (third person).`,
    `- keyResponsibilities: 3-5 concrete bullets (skip if not evidenced).`,
    `- technologiesMentioned: every named tech/tool/platform from the description.`,
    `- scopeSignals: quantitative or scope claims ("led team of 5", "shipped to 1M users", "$X revenue").`,
    `- seniorityLevel: pick from {internship, junior, mid, senior, staff, principal, unknown} based on title + description.`,
  ].join("\n");

  const { model, modelId } = pickModel("fast", credentials);
  const { value } = await generateValidatedJson({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    schema: ExperienceSummarySchema,
    schemaHint: EXPERIENCE_SCHEMA_HINT,
  });

  return {
    ...value,
    experienceKey: experienceKey(experience),
    position,
    company,
    generatedByModel: modelId,
    generatedAt: new Date().toISOString(),
    sourceContentHash: experienceContentHash(experience),
  };
}

export function experienceKey(experience: LinkedInExperience): string {
  const company = experience.company ?? "unknown";
  const title = experience.position_title ?? "unknown";
  const start = experience.from_date ?? "?";
  return `${company}::${title}::${start}`;
}

export function experienceContentHash(experience: LinkedInExperience): string {
  const composed = [
    experience.position_title ?? "",
    experience.company ?? "",
    experience.from_date ?? "",
    experience.to_date ?? "",
    experience.location ?? "",
    (experience.description ?? "").slice(0, 2000),
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < composed.length; i++) {
    h ^= composed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
