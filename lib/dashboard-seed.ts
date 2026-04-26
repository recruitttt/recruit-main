import type { EventLogItem, StatusTone } from "@/components/design-system";

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
  progress: number;
};

export type ActiveRun = {
  id: string;
  company: string;
  role: string;
  provider: string;
  mode: "live" | "recorded" | "seeded";
  state: "running" | "paused" | "blocked" | "completed" | "stopped";
  currentStep: string;
  summary: string;
  steps: Array<{
    label: string;
    status: "complete" | "active" | "blocked" | "pending";
  }>;
};

export type ProviderCoverage = {
  provider: string;
  status: string;
  tone: StatusTone;
  detail: string;
};

export type ApplicationRow = {
  company: string;
  role: string;
  provider: string;
  match: string;
  status: string;
  tone: StatusTone;
  artifact: string;
};

export type DlqSummary = {
  title: string;
  question: string;
  answerability: string;
  impact: string;
  tone: StatusTone;
};

export type ActivityEvent = EventLogItem & {
  evidence?: string;
};

export type ArtifactSummary = {
  title: string;
  meta: string;
  type: "file" | "preview" | "attachment";
};

export type DashboardSeed = {
  generatedAt: string;
  mode: "live" | "seeded fallback";
  metrics: DashboardMetric[];
  activeRun: ActiveRun | null;
  providers: ProviderCoverage[];
  applications: ApplicationRow[];
  dlq: DlqSummary[];
  activity: ActivityEvent[];
  artifacts: ArtifactSummary[];
};

export const dashboardSeed: DashboardSeed = {
  generatedAt: "Apr 24, 09:12",
  mode: "seeded fallback",
  metrics: [
    { label: "Applications", value: "23", detail: "+7 this week", tone: "accent", progress: 72 },
    { label: "Active runs", value: "3", detail: "1 live, 2 queued", tone: "active", progress: 60 },
    { label: "Needs review", value: "4", detail: "2 need approval", tone: "warning", progress: 38 },
    { label: "Cache reuse", value: "67.8%", detail: "312 answers", tone: "neutral", progress: 68 },
    { label: "Time saved", value: "18.5h", detail: "rolling 7 days", tone: "success", progress: 82 },
  ],
  activeRun: {
    id: "RUN-A42",
    company: "Ashby Systems",
    role: "Product Engineer Intern",
    provider: "Ashby",
    mode: "live",
    state: "running",
    currentStep: "Waiting on one human-safe work authorization answer",
    summary: "Direct application URL discovered required questions, uploaded the AI Product resume, and stopped before guessing sensitive data.",
    steps: [
      { label: "Discover", status: "complete" },
      { label: "Map questions", status: "complete" },
      { label: "Attach artifact", status: "complete" },
      { label: "Human approval", status: "active" },
      { label: "Classify submit", status: "pending" },
    ],
  },
  providers: [
    { provider: "Ashby", status: "live proof", tone: "success", detail: "direct URL flow captured" },
    { provider: "Greenhouse", status: "stretch", tone: "neutral", detail: "direct-form only" },
    { provider: "Lever", status: "target needed", tone: "warning", detail: "validation pending" },
    { provider: "Workday", status: "replay only", tone: "neutral", detail: "seeded artifact" },
  ],
  applications: [
    { company: "Ashby Systems", role: "Product Engineer Intern", provider: "Ashby", match: "94%", status: "needs approval", tone: "warning", artifact: "resume + cover" },
    { company: "Linear", role: "Product Engineer", provider: "Ashby", match: "91%", status: "queued", tone: "neutral", artifact: "resume ready" },
    { company: "Notion", role: "AI Product Engineer", provider: "Seeded", match: "88%", status: "submitted", tone: "success", artifact: "recorded" },
    { company: "Radiant", role: "SWE Intern", provider: "Greenhouse", match: "84%", status: "blocked", tone: "danger", artifact: "review queue" },
  ],
  dlq: [
    { title: "Work authorization", question: "Are you legally authorized to work in the United States?", answerability: "human required", impact: "Unlocks 6 future forms after approval", tone: "warning" },
    { title: "Portfolio upload", question: "Upload a portfolio or project proof document.", answerability: "artifact needed", impact: "Resume attached; portfolio optional", tone: "neutral" },
  ],
  activity: [
    { time: "09:12", type: "seen", title: "Parsed Ashby form", detail: "Detected 14 fields and 4 required custom questions.", evidence: "screenshot" },
    { time: "09:13", type: "tool", title: "Uploaded resume PDF", detail: "AI Product resume uploaded; form rediscovered after rerender.", evidence: "artifact" },
    { time: "09:14", type: "decision", title: "Stopped for approval", detail: "Work authorization question requires verified candidate truth.", evidence: "review queue" },
    { time: "09:15", type: "success", title: "Fallback state synced", detail: "Seeded dashboard mirrors the same live data contract.", evidence: "seed" },
  ],
  artifacts: [
    { title: "AI Product resume", meta: "PDF · 148 KB", type: "file" },
    { title: "Ashby recording", meta: "browser replay", type: "preview" },
    { title: "Submit evidence", meta: "classified pending", type: "attachment" },
  ],
};
