import { z } from "zod";

export const DashboardCommandJobSchema = z.object({
  jobId: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  score: z.number().optional(),
  rank: z.number().optional(),
  statusLabel: z.string().optional(),
  providerLabel: z.string().optional(),
  compensationSummary: z.string().optional(),
  rationale: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const DashboardCommandContextSchema = z.object({
  jobs: z.array(DashboardCommandJobSchema).max(200).default([]),
  selectedJobId: z.string().optional().nullable(),
  visibleJobIds: z.array(z.string()).max(200).optional(),
  filters: z.record(z.unknown()).optional(),
  run: z.record(z.unknown()).optional().nullable(),
  profileSummary: z.string().max(4000).optional(),
});

export const DashboardCommandRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  context: DashboardCommandContextSchema.default({ jobs: [] }),
});

export const DashboardCommandResponseSchema = z.object({
  intent: z.enum(["filter", "reorder", "explain", "summarize", "clear", "unknown"]),
  answer: z.string().min(1).max(1200),
  filters: z
    .array(z.object({
      field: z.string().min(1).max(80),
      op: z.enum(["equals", "contains", "not_contains", "gte", "lte", "in"]),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      label: z.string().min(1).max(120),
    }))
    .default([]),
  reorder: z
    .object({
      jobIds: z.array(z.string()).max(200),
      reason: z.string().min(1).max(400),
    })
    .nullable()
    .default(null),
  explanations: z
    .array(z.object({
      jobId: z.string().min(1),
      summary: z.string().min(1).max(500),
      evidence: z.array(z.string().min(1).max(160)).max(5).default([]),
    }))
    .default([]),
  suggestedChips: z.array(z.string().min(1).max(80)).max(6).default([]),
});

export type DashboardCommandRequest = z.infer<typeof DashboardCommandRequestSchema>;
export type DashboardCommandResponse = z.infer<typeof DashboardCommandResponseSchema>;
export type DashboardCommandJob = z.infer<typeof DashboardCommandJobSchema>;

export type DashboardCommandModelResult =
  | {
      ok: true;
      value: DashboardCommandResponse;
      raw: string;
      provider: "k2" | "anthropic" | "demo";
      modelId: string;
      fallbackUsed: boolean;
    }
  | {
      ok: false;
      reason: string;
      providerAttempts: Array<{ provider: string; reason: string }>;
    };
