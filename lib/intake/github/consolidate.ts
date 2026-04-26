import type { LinkedInSnapshot } from "@/lib/intake/linkedin";
import type { ApplicationProfile } from "@/lib/intake/shared";
import { generateValidatedJson } from "./json";
import { pickModel, type AICredentials } from "./models";
import { CONSOLIDATE_SYSTEM_PROMPT, consolidateUserPrompt, type ConsolidatePromptInput } from "./prompts";
import {
  ConsolidatedReportFieldsSchema,
  type ConsolidatedReport,
  type ExperienceSummary,
  type RepoSummary,
} from "./types";

export interface ConsolidateInput {
  profile: ApplicationProfile;
  repoSummaries: RepoSummary[];
  experienceSummaries: ExperienceSummary[];
  linkedinSnapshot?: LinkedInSnapshot;
  repoMetrics: Record<string, { stars: number; pushedAt?: string }>;
  accountAgeYears?: number;
  totalStars: number;
  pinnedRepoCount: number;
  sponsorsReceived: number;
  achievementsCount: number;
  credentials: AICredentials;
}

export async function consolidateReport(input: ConsolidateInput): Promise<{ report: ConsolidatedReport; promptInput: ConsolidatePromptInput }> {
  const { model, modelId } = pickModel("deep", input.credentials);
  const fullName = [
    input.profile.identity.legalFirstName,
    input.profile.identity.legalLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const repoBlocks = input.repoSummaries.map((s) => ({
    repoFullName: s.repoFullName,
    oneLineDescription: s.oneLineDescription,
    whatItDoes: s.whatItDoes,
    metadataSummary: s.metadataSummary,
    keyTechnologies: s.keyTechnologies,
    userContributions: s.userContributions,
    accomplishments: s.accomplishments,
    difficulty: s.difficulty,
    starQuality: s.starQuality,
    notableImplementationDetails: s.notableImplementationDetails,
    metrics: input.repoMetrics[s.repoFullName] ?? { stars: 0 },
  }));

  const experienceBlocks = input.experienceSummaries.map((e) => {
    const raw = input.linkedinSnapshot?.experiences.find(
      (x) =>
        (x.company ?? "unknown") === e.company &&
        (x.position_title ?? "unknown") === e.position,
    );
    return {
      position: e.position,
      company: e.company,
      fromDate: raw?.from_date ?? undefined,
      toDate: raw?.to_date ?? undefined,
      roleSummary: e.roleSummary,
      keyResponsibilities: e.keyResponsibilities,
      technologiesMentioned: e.technologiesMentioned,
      scopeSignals: e.scopeSignals,
      seniorityLevel: e.seniorityLevel,
    };
  });

  const eduBlocks =
    input.linkedinSnapshot?.educations.map((e) => ({
      institution: e.institution ?? "(unknown)",
      degree: e.degree ?? undefined,
      fromDate: e.from_date ?? undefined,
      toDate: e.to_date ?? undefined,
    })) ?? [];

  const promptInput: ConsolidatePromptInput = {
    repoSummaries: repoBlocks,
    experienceSummaries: experienceBlocks,
    rawEducations: eduBlocks,
    hasLinkedIn: !!input.linkedinSnapshot,
    profile: {
      fullName: fullName || (input.profile.identity.preferredName ?? ""),
      bio: input.profile.essays?.find((e) => e.promptKey === "elevator_pitch")?.response,
      accountAgeYears: input.accountAgeYears,
      skills: {
        languages: input.profile.skills.languages.map((l) => l.name),
        frameworks: input.profile.skills.frameworks.map((f) => f.name),
        tools: input.profile.skills.tools,
        cloudPlatforms: input.profile.skills.cloudPlatforms,
        databases: input.profile.skills.databases,
      },
      repoCount: input.profile.projects.length,
      pinnedRepoCount: input.pinnedRepoCount,
      starsReceived: input.totalStars,
      externalContributions: input.profile.openSource?.length ?? 0,
      sponsors: input.sponsorsReceived,
      achievements: input.achievementsCount,
    },
  };

  const { value } = await generateValidatedJson({
    model,
    system: CONSOLIDATE_SYSTEM_PROMPT,
    prompt: consolidateUserPrompt(promptInput),
    schema: ConsolidatedReportFieldsSchema,
    maxRetries: 2,
  });

  return {
    report: {
      ...value,
      generatedByModel: modelId,
      generatedAt: new Date().toISOString(),
    },
    promptInput,
  };
}
