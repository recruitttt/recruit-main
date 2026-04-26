"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { JobIngestionPanel } from "@/components/dashboard/job-ingestion-panel";
import { ActionButton as Button, GlassCard, Panel, StatusBadge as Pill } from "@/components/design-system";
import { convexRefs } from "@/lib/convex-refs";
import { readProfile } from "@/lib/profile";
import { downloadPdf, runTailorJob } from "@/lib/tailor/client";
import type { Job, JobResearch, PipelineEvent, TailoredApplication } from "@/lib/tailor/types";

type Recommendation = {
  _id: string;
  jobId: string;
  rank: number;
  score: number;
  llmScore?: number;
  company: string;
  title: string;
  location?: string;
  jobUrl: string;
  compensationSummary?: string;
  rationale?: string;
  job?: {
    company?: string;
    title?: string;
    location?: string;
    descriptionPlain?: string;
    jobUrl?: string;
  } | null;
};

type JobDetail = {
  job?: {
    _id: string;
    runId: string;
    company: string;
    title: string;
    location?: string;
    jobUrl: string;
    descriptionPlain?: string;
    compensationSummary?: string;
    department?: string;
    team?: string;
  };
  decision?: {
    status: "kept" | "rejected";
    reasons: string[];
    ruleScore: number;
  };
  score?: {
    totalScore: number;
    llmScore?: number;
    rationale?: string;
    strengths: string[];
    risks: string[];
    scoringMode: string;
  };
  recommendation?: Recommendation;
  tailoredApplication?: {
    status: "tailoring" | "completed" | "failed";
    tailoredResume?: TailoredApplication["tailoredResume"];
    research?: JobResearch;
    tailoringScore?: number;
    keywordCoverage?: number;
    pdfReady: boolean;
    pdfFilename?: string;
    pdfByteLength?: number;
    error?: string;
  };
  artifacts?: Array<{
    _id: string;
    kind: "ingested_description" | "ranking_score" | "research_snapshot" | "tailored_resume" | "pdf_ready";
    title: string;
    content?: string;
    payload?: unknown;
    createdAt: string;
  }>;
};

type TailorState = {
  running: boolean;
  message: string;
  error?: string;
  downloadable?: TailoredApplication;
};

export function DevPipelineWorkspace() {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (!hasConvex) {
    return (
      <Panel title="End-to-End Pipeline" description="Connect Convex to run ingestion, inspect job descriptions, and persist tailoring artifacts.">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.92fr]">
          <JobIngestionPanel />
          <JobDetailDrawer
            detail={null}
            selected={null}
            tailorState={{
              running: false,
              message: "Connect Convex to inspect job artifacts.",
            }}
            onClose={() => undefined}
            onTailor={() => undefined}
          />
        </div>
      </Panel>
    );
  }

  return <ConnectedDevPipelineWorkspace />;
}

function ConnectedDevPipelineWorkspace() {
  const [selected, setSelected] = React.useState<Recommendation | null>(null);
  const [tailorState, setTailorState] = React.useState<TailorState>({
    running: false,
    message: "Select a ranked job to inspect and tailor.",
  });
  const detail = useQuery(
    convexRefs.ashby.jobDetail,
    selected?.jobId ? { jobId: selected.jobId } : "skip",
  ) as JobDetail | null | undefined;
  const persistTailoring = useMutation(convexRefs.ashby.upsertTailoredApplication);

  async function tailorSelectedJob() {
    if (!selected?.jobId || !detail?.job || tailorState.running) return;

    const profile = readProfile();
    if (!profile.name || !profile.email || profile.experience.length === 0) {
      setTailorState({
        running: false,
        message: "Complete onboarding first so the tailor has a real profile.",
        error: "profile_incomplete",
      });
      return;
    }

    const job: Job = {
      id: selected.jobId,
      company: detail.job.company,
      role: detail.job.title,
      jobUrl: detail.job.jobUrl,
      location: detail.job.location,
      descriptionPlain: detail.job.descriptionPlain,
    };
    let researchSnapshot: JobResearch | undefined;

    setTailorState({ running: true, message: "Starting research...", downloadable: undefined });
    await persistTailoring({
      jobId: selected.jobId,
      status: "tailoring",
      job,
      pdfReady: false,
    });

    const handleEvent = (event: PipelineEvent) => {
      if (event.type === "research-start") {
        setTailorState((current) => ({ ...current, message: "Researching job description..." }));
      } else if (event.type === "research-done") {
        researchSnapshot = event.research;
        setTailorState((current) => ({ ...current, message: "Tailoring resume..." }));
      } else if (event.type === "tailor-start") {
        setTailorState((current) => ({ ...current, message: "Writing tailored resume and PDF..." }));
      } else if (event.type === "error") {
        setTailorState({ running: false, message: `${event.phase} failed`, error: event.reason });
      }
    };

    const application = await runTailorJob(job, profile, handleEvent, { useCache: false });
    if (!application) {
      await persistTailoring({
        jobId: selected.jobId,
        status: "failed",
        job,
        research: researchSnapshot,
        pdfReady: false,
        error: tailorState.error ?? "tailor_failed",
      });
      return;
    }

    const pdfFilename = pdfName(application);
    await persistTailoring({
      jobId: selected.jobId,
      status: "completed",
      job: application.job,
      research: researchSnapshot,
      tailoredResume: application.tailoredResume,
      tailoringScore: application.tailoringScore,
      keywordCoverage: application.keywordCoverage,
      durationMs: application.durationMs,
      pdfReady: true,
      pdfFilename,
      pdfByteLength: base64ByteLength(application.pdfBase64),
    });

    setTailorState({
      running: false,
      message: "Tailored resume ready.",
      downloadable: application,
    });
  }

  return (
    <Panel title="End-to-End Pipeline" description="Run ingestion, inspect scraped jobs, tailor a selected resume, and verify persisted artifacts.">
      <div className="grid gap-5 xl:grid-cols-[1fr_0.92fr]">
        <JobIngestionPanel
          selectedJobId={selected?.jobId}
          onSelectJob={(job) => {
            setSelected(job);
            setTailorState({
              running: false,
              message: "Inspect the job description, then tailor this job.",
            });
          }}
        />
        <JobDetailDrawer
          detail={detail}
          selected={selected}
          tailorState={tailorState}
          onClose={() => setSelected(null)}
          onTailor={() => void tailorSelectedJob()}
        />
      </div>
    </Panel>
  );
}

function JobDetailDrawer({
  detail,
  selected,
  tailorState,
  onClose,
  onTailor,
}: {
  detail: JobDetail | null | undefined;
  selected: Recommendation | null;
  tailorState: TailorState;
  onClose: () => void;
  onTailor: () => void;
}) {
  if (!selected) {
    return (
      <GlassCard className="flex min-h-[420px] items-center justify-center text-center">
        <div>
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <div className="mt-3 text-sm font-semibold text-slate-950">No job selected</div>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
            Run the first 3 Ashby sources, then click a ranked recommendation to inspect the captured job description and artifacts.
          </p>
        </div>
      </GlassCard>
    );
  }

  const loading = detail === undefined;
  const job = detail?.job;
  const artifacts = detail?.artifacts ?? [];
  const tailored = detail?.tailoredApplication;

  return (
    <GlassCard className="min-h-[420px] p-0">
      <div className="flex items-start justify-between gap-4 border-b border-white/45 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="active">selected job</Pill>
            {detail?.score && <Pill tone="success">score {Math.round(detail.score.totalScore)}</Pill>}
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">
            {job?.title ?? selected.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{job?.company ?? selected.company}</p>
          <a
            href={job?.jobUrl ?? selected.jobUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-slate-500 hover:text-sky-600"
          >
            original job <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/60 bg-white/50 p-2 text-slate-600 hover:text-slate-950"
          aria-label="Close job detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onTailor} disabled={loading || tailorState.running}>
            {tailorState.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Tailor this job
          </Button>
          {tailorState.downloadable && (
            <Button size="sm" variant="secondary" onClick={() => downloadPdf(tailorState.downloadable!)}>
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          )}
          {tailored?.pdfReady && !tailorState.downloadable && (
            <Pill tone="neutral">{tailored.pdfFilename ?? "PDF generated"}</Pill>
          )}
        </div>

        <div className="rounded-[18px] border border-white/45 bg-white/28 px-4 py-3 text-sm text-slate-600">
          {tailorState.error ? (
            <span className="inline-flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {tailorState.error}
            </span>
          ) : (
            tailorState.message
          )}
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-white/45 bg-white/24 p-4 text-sm text-slate-500">
            Loading job artifacts...
          </div>
        ) : (
          <div className="space-y-3">
            <TimelineItem title="Ingested job description" complete={Boolean(job?.descriptionPlain)}>
              <ArtifactText text={job?.descriptionPlain ?? "No captured description for this job yet."} />
            </TimelineItem>
            <TimelineItem title="Ranking and recommendation" complete={Boolean(detail?.score)}>
              <p className="text-sm leading-6 text-slate-600">{detail?.score?.rationale ?? selected.rationale ?? "No ranking rationale recorded."}</p>
              {detail?.score && (
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <Metric label="Total" value={Math.round(detail.score.totalScore)} />
                  <Metric label="LLM" value={detail.score.llmScore ?? "n/a"} />
                  <Metric label="Mode" value={detail.score.scoringMode} />
                </div>
              )}
            </TimelineItem>
            <TimelineItem title="Research snapshot" complete={Boolean(tailored?.research || artifactOf(artifacts, "research_snapshot"))}>
              <ArtifactText text={researchText(tailored?.research ?? artifactOf(artifacts, "research_snapshot")?.payload)} />
            </TimelineItem>
            <TimelineItem title="Tailored resume" complete={Boolean(tailored?.tailoredResume || artifactOf(artifacts, "tailored_resume"))}>
              <ArtifactText text={resumeText(tailored?.tailoredResume ?? artifactOf(artifacts, "tailored_resume")?.payload)} />
            </TimelineItem>
            <TimelineItem title="PDF output" complete={Boolean(tailored?.pdfReady)}>
              <p className="text-sm leading-6 text-slate-600">
                {tailored?.pdfReady
                  ? `${tailored.pdfFilename ?? "Tailored resume PDF"}${tailored.pdfByteLength ? ` · ${Math.round(tailored.pdfByteLength / 1024)} KB` : ""}`
                  : "Run tailoring to generate a downloadable PDF for this session."}
              </p>
            </TimelineItem>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function TimelineItem({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-white/45 bg-white/24 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className={complete ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-400"} />
        <div className="text-sm font-semibold text-slate-950">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-white/45 bg-white/30 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ArtifactText({ text }: { text: string }) {
  return (
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[14px] border border-white/45 bg-white/35 p-3 text-xs leading-5 text-slate-700">
      {text}
    </pre>
  );
}

function artifactOf(artifacts: JobDetail["artifacts"], kind: NonNullable<JobDetail["artifacts"]>[number]["kind"]) {
  return artifacts?.find((artifact) => artifact.kind === kind);
}

function researchText(value: unknown): string {
  if (!value || typeof value !== "object") return "No research snapshot yet.";
  const research = value as Partial<JobResearch>;
  return [
    research.jdSummary,
    research.requirements?.length ? `Requirements:\n- ${research.requirements.join("\n- ")}` : "",
    research.techStack?.length ? `Tech stack:\n- ${research.techStack.join("\n- ")}` : "",
    research.cultureSignals?.length ? `Signals:\n- ${research.cultureSignals.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}

function resumeText(value: unknown): string {
  if (!value || typeof value !== "object") return "No tailored resume yet.";
  const resume = value as TailoredApplication["tailoredResume"];
  return [
    resume.experience?.length
      ? `Experience:\n${resume.experience
          .map((item) => `${item.title} · ${item.company}\n- ${item.bullets.join("\n- ")}`)
          .join("\n\n")}`
      : "",
    resume.education?.length
      ? `Education:\n${resume.education
          .map((item) => [item.school, item.degree, item.field].filter(Boolean).join(" · "))
          .join("\n")}`
      : "",
    resume.skills?.length ? `Skills: ${resume.skills.join(", ")}` : "",
    resume.projects?.length
      ? `Projects:\n${resume.projects
          .map((item) => `${item.name}\n- ${item.bullets.join("\n- ")}`)
          .join("\n\n")}`
      : "",
    resume.tailoringNotes?.qualityIssues?.length
      ? `Quality checks:\n- ${resume.tailoringNotes.qualityIssues.join("\n- ")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

function pdfName(application: TailoredApplication): string {
  const safeCompany = application.job.company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Resume_${safeCompany || "Tailored"}.pdf`;
}

function base64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}
