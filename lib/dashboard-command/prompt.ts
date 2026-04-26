import type { DashboardCommandRequest } from "./types";

export const DASHBOARD_COMMAND_SYSTEM_PROMPT = `You are the Recruit dashboard command model.

The user is controlling a jobs dashboard. Convert their command into structured JSON that the UI can use to filter, reorder, or explain jobs.

Rules:
- Use only jobs and facts in dashboardContext.
- Never invent job IDs. reorder.jobIds and explanations[].jobId must come from dashboardContext.jobs.
- If the user asks to rank, sort, prioritize, or compare roles, use intent "reorder" and include job IDs in best-first order.
- If the user asks to show, hide, narrow, or find roles, use intent "filter" and fill filters.
- If the user asks to remove, exclude, hide, avoid, or skip a company, use intent "filter" with field "company", op "not_contains", and the company token as value.
- If the user asks why, explain, or "tell me about this", use intent "explain" and cite concise evidence.
- If the user asks to reset filters, use intent "clear".
- Keep answer short and directly usable in a command bar.
- Return one JSON object only. No markdown.`;

export function buildDashboardCommandUserPrompt(input: DashboardCommandRequest): string {
  return JSON.stringify({
    userPrompt: input.prompt,
    dashboardContext: {
      ...input.context,
      jobs: input.context.jobs.map((job) => ({
        jobId: job.jobId,
        title: job.title,
        company: job.company,
        location: job.location,
        score: job.score,
        rank: job.rank,
        statusLabel: job.statusLabel,
        providerLabel: job.providerLabel,
        compensationSummary: job.compensationSummary,
        rationale: job.rationale,
        strengths: job.strengths?.slice(0, 6),
        risks: job.risks?.slice(0, 6),
        tags: job.tags?.slice(0, 12),
      })),
    },
    requiredJsonShape: {
      intent: "filter | reorder | explain | summarize | clear | unknown",
      answer: "short natural-language response",
      filters: [{ field: "location", op: "contains", value: "New York", label: "Location includes New York" }],
      reorder: { jobIds: ["job_1"], reason: "why this order helps" },
      explanations: [{ jobId: "job_1", summary: "why it matches", evidence: ["short cited fact"] }],
      suggestedChips: ["Remote roles", "Explain top fit"],
    },
  });
}
