import { z } from "zod";

export const RepoSummarySchema = z.object({
  oneLineDescription: z.string(),
  // Comprehensive 4-6 sentence summary of what the project does, derived
  // primarily from reading the actual source code (entry points, public
  // APIs, control flow, abstractions, patterns, notable implementation
  // choices). The README, topics and manifests inform but do not dominate
  // this field — that role belongs to `metadataSummary` below.
  whatItDoes: z.string(),
  // 1-2 sentence README/dependency-derived recap. Not a substitute for
  // `whatItDoes`; this is the metadata-only view of the project for
  // contrast with the code-grounded summary.
  metadataSummary: z.string().optional().default(""),
  keyTechnologies: z.array(z.string()),
  userContributions: z.string(),
  accomplishments: z.array(z.string()),
  difficulty: z.string(),
  starQuality: z.string(),
  // Bulleted breakdown of specific implementation choices the model
  // observed in the code (concurrency model, error-handling style, schema
  // validation, custom abstractions, interesting algorithms, etc.).
  notableImplementationDetails: z.array(z.string()).optional().default([]),
  // Repo-relative file paths the model fetched via the code-explorer tools, in
  // the order they were first read. Empty when the explorer was disabled or
  // when the model didn't request any files. Optional with default for
  // back-compat with rows persisted before this field existed.
  exploredFiles: z.array(z.string()).optional().default([]),
  // ---- Deprecated, kept optional for back-compat with stored summaries ----
  // These two fields used to carry code-derived purpose / architecture text.
  // They are now folded into `whatItDoes`. Old rows still parse cleanly; new
  // summaries leave them at their default empty strings.
  purposeFromCode: z.string().optional().default(""),
  architectureSummary: z.string().optional().default(""),
});

export type RepoSummaryFields = z.infer<typeof RepoSummarySchema>;

export interface RepoSummary extends RepoSummaryFields {
  repoFullName: string;
  generatedByModel: string;
  generatedAt: string;
  sourceContentHash: string;
}

export const ExperienceSummarySchema = z.object({
  roleSummary: z.string(),
  keyResponsibilities: z.array(z.string()),
  technologiesMentioned: z.array(z.string()),
  scopeSignals: z.array(z.string()),
  seniorityLevel: z.string(),
});

export type ExperienceSummaryFields = z.infer<typeof ExperienceSummarySchema>;

export interface ExperienceSummary extends ExperienceSummaryFields {
  experienceKey: string;
  position: string;
  company: string;
  generatedByModel: string;
  generatedAt: string;
  sourceContentHash: string;
}

export const EXPERIENCE_SCHEMA_HINT = `{
  "roleSummary": "string (1-2 sentences)",
  "keyResponsibilities": ["string", "..."],
  "technologiesMentioned": ["string", "..."],
  "scopeSignals": ["string", "..."],
  "seniorityLevel": "internship | junior | mid | senior | staff | principal | unknown"
}`;

export const ConsolidatedReportFieldsSchema = z.object({
  executiveSummary: z.string(),
  technicalIdentity: z.string(),
  coreStrengths: z.array(z.string()),
  domainsAndInterests: z.array(z.string()),
  projectThemes: z.array(z.string()),
  engineeringPractices: z.array(z.string()),
  notableTools: z.array(z.string()),
  notableAccomplishments: z.array(z.string()),
  growthAreas: z.array(z.string()),
  portfolioImprovements: z.array(z.string()),
  careerNarrative: z.string(),
  githubLinkedinAlignment: z.array(z.string()),
  linkedinOnlySummary: z.string(),
  linkedinDataQuality: z.array(z.string()),
});
export type ConsolidatedReportFields = z.infer<typeof ConsolidatedReportFieldsSchema>;

export interface ConsolidatedReport extends ConsolidatedReportFields {
  generatedByModel: string;
  generatedAt: string;
}

export type ReportProgress =
  | { stage: "starting"; message: string }
  | { stage: "summarize-repo"; done: number; total: number; current: string }
  | { stage: "summarize-experience"; done: number; total: number; current: string }
  | { stage: "consolidate"; message: string }
  | { stage: "complete"; message: string }
  | { stage: "error"; error: string };

export const REPO_SCHEMA_HINT = `{
  "oneLineDescription": "string (max 240 chars)",
  "whatItDoes": "string (4-6 sentences, MIN 400 chars). Comprehensive code-grounded summary: what the code actually does (operations + data flow), the architectural shape, key abstractions and patterns, notable implementation choices. Cite specific identifiers, file names, and behaviours you observed in the source.",
  "metadataSummary": "string (1-2 sentences, README/dependency recap; describes what the project says about itself, separate from what the code reveals)",
  "keyTechnologies": ["string", "..."],
  "userContributions": "string (2-3 sentences, third-person)",
  "accomplishments": ["string", "..."],
  "difficulty": "beginner | intermediate | advanced | expert",
  "starQuality": "showcase | solid | experimental | learning",
  "notableImplementationDetails": ["string", "..."] (2-5 specific choices, each grounded in code you read),
  "exploredFiles": ["string", "..."] (repo-relative paths you read via read_file)
}`;

export const CONSOLIDATED_SCHEMA_HINT = `{
  "executiveSummary": "string (4-6 sentences)",
  "technicalIdentity": "string (2-3 paragraphs)",
  "coreStrengths": ["string", "..."],
  "domainsAndInterests": ["string", "..."],
  "projectThemes": ["string", "..."],
  "engineeringPractices": ["string", "..."],
  "notableTools": ["string", "..."],
  "notableAccomplishments": ["string", "..."],
  "growthAreas": ["string", "..."],
  "portfolioImprovements": ["string", "..."]
}`;
