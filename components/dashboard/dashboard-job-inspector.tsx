"use client";

import { Download, ExternalLink, Eye, FileText, Loader2, Sparkles } from "lucide-react";
import { ActionButton, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import type { JobResearch } from "@/lib/tailor/types";
import { DashboardScoreCore } from "./dashboard-score-core";
import type { JobDetail, LiveRecommendation, TailorState } from "./dashboard-types";

type DashboardJobInspectorProps = {
  selected: LiveRecommendation | null;
  detail: JobDetail | null | undefined;
  detailError?: string;
  state: TailorState;
  pdf: {
    canView: boolean;
    canDownload: boolean;
    filename?: string;
    sizeKb?: number;
    ready: boolean;
  };
  inline?: boolean;
  onTailor: () => void;
  onOpenPdf: () => void;
  onDownload: () => void;
};

export function DashboardJobInspector({
  selected,
  detail,
  detailError,
  state,
  pdf,
  inline = false,
  onTailor,
  onOpenPdf,
  onDownload,
}: DashboardJobInspectorProps) {
  if (!selected) {
    return (
      <section className={shellClasses(inline)}>
        <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-white/55 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white/80">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950">
            Pick a job to inspect
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Click a ranked entry to open the fit rationale, captured job facts, and tailoring controls.
          </p>
        </div>
      </section>
    );
  }

  const loading = detail === undefined;
  const job = detail?.job ?? selected.job ?? null;
  const resolvedJobUrl = job?.jobUrl ?? selected.jobUrl;
  const resolvedTitle = job?.title ?? selected.title;
  const resolvedCompany = job?.company ?? selected.company;
  const resolvedLocation = job?.location ?? selected.location;
  const resolvedScore = detail?.score?.totalScore ?? selected.score;
  const strengths = detail?.score?.strengths ?? selected.strengths ?? [];
  const risks = detail?.score?.risks ?? selected.risks ?? [];
  const rationale = detail?.score?.rationale ?? selected.rationale ?? "No ranking rationale recorded yet.";
  const research = readResearch(detail);
  const tailored = detail?.tailoredApplication;
  const importantFacts = [
    { label: "Compensation", value: job?.compensationSummary ?? selected.compensationSummary },
    { label: "Department", value: detail?.job?.department },
    { label: "Team", value: detail?.job?.team },
    { label: "Source", value: sourceLabel(selected, detail) },
  ].filter((fact) => Boolean(fact.value));

  return (
    <section className={shellClasses(inline)}>
      <div className="space-y-4">
        <div className="rounded-[30px] border border-white/65 bg-white/78 p-5 shadow-[0_28px_72px_-42px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="active">Selected</StatusBadge>
                <StatusBadge tone={state.error ? "danger" : tailored?.status === "completed" ? "success" : "neutral"}>
                  {state.error ? "Needs attention" : tailored?.status ?? "Ready"}
                </StatusBadge>
              </div>
              <h2 className="mt-4 text-[clamp(1.6rem,2vw,2.3rem)] font-semibold tracking-[-0.05em] text-slate-950">
                {resolvedTitle}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{resolvedCompany}</span>
                {resolvedLocation ? <span>{resolvedLocation}</span> : null}
                <span>{sourceLabel(selected, detail)}</span>
              </div>
            </div>

            <a
              href={resolvedJobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
            >
              Original role
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {detailError ? (
          <section className="rounded-[24px] border border-red-200 bg-red-50/85 px-4 py-3 text-sm text-red-700">
            {detailError}
          </section>
        ) : null}

        <DashboardScoreCore
          score={resolvedScore}
          rank={selected.rank}
          tailoringScore={tailored?.tailoringScore}
          keywordCoverage={tailored?.keywordCoverage}
        />

        <section className={sectionClasses()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={eyebrowClasses()}>Fit summary</div>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                Why it made the board
              </h3>
            </div>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">{rationale}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <BulletColumn title="Strengths" items={strengths} emptyLabel="No strengths captured yet." tone="emerald" />
            <BulletColumn title="Risks" items={risks} emptyLabel="No risk notes captured yet." tone="amber" />
          </div>
        </section>

        {importantFacts.length > 0 ? (
          <section className={sectionClasses()}>
            <div className={eyebrowClasses()}>Important job facts</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {importantFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-[20px] border border-slate-200/70 bg-white/80 px-4 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {fact.label}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">{fact.value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={sectionClasses()}>
          <div className={eyebrowClasses()}>Research snapshot</div>
          {research ? (
            <div className="mt-4 space-y-4">
              {research.jdSummary ? (
                <p className="text-sm leading-7 text-slate-700">{research.jdSummary}</p>
              ) : null}
              <ResearchList title="Requirements" items={research.requirements} />
              <ResearchList title="Tech stack" items={research.techStack} />
              <ResearchList title="Culture signals" items={research.cultureSignals} />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Research appears after a tailoring run writes the snapshot artifact.
            </p>
          )}
        </section>

        <section className={sectionClasses()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={eyebrowClasses()}>Tailoring</div>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                Resume and PDF actions
              </h3>
            </div>
            {pdf.ready ? <StatusBadge tone="success">PDF ready</StatusBadge> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton onClick={onTailor} disabled={loading || state.running}>
              {state.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tailor selected job
            </ActionButton>
            <ActionButton variant="secondary" onClick={onOpenPdf} disabled={!pdf.canView}>
              <Eye className="h-4 w-4" />
              View PDF
            </ActionButton>
            <ActionButton variant="secondary" onClick={onDownload} disabled={!pdf.canDownload}>
              <Download className="h-4 w-4" />
              Download PDF
            </ActionButton>
          </div>

          <div
            className={cn(
              "mt-4 rounded-[20px] border px-4 py-3 text-sm leading-6",
              state.error
                ? "border-red-200 bg-red-50/85 text-red-700"
                : "border-slate-200/70 bg-white/80 text-slate-600",
            )}
          >
            {state.error ?? state.message}
            {pdf.filename ? (
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                {pdf.filename}
                {pdf.sizeKb ? ` · ${pdf.sizeKb} KB` : ""}
              </div>
            ) : null}
          </div>
        </section>

        <details className="rounded-[24px] border border-slate-200/80 bg-white/78 px-5 py-4 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.24)]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            Raw captured description
          </summary>
          <div className="mt-4 rounded-[18px] border border-slate-200/70 bg-slate-50/90 p-4 text-sm leading-7 text-slate-700">
            {(job?.descriptionPlain ?? selected.job?.descriptionPlain)?.trim() || "No captured description for this role yet."}
          </div>
        </details>
      </div>
    </section>
  );
}

function BulletColumn({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "emerald" | "amber";
}) {
  const toneClasses = tone === "emerald"
    ? "bg-emerald-500 border-emerald-500/20"
    : "bg-amber-500 border-amber-500/20";

  return (
    <div className="rounded-[20px] border border-slate-200/70 bg-white/80 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
              <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", toneClasses)} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function ResearchList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function readResearch(detail: JobDetail | null | undefined): JobResearch | null {
  if (detail?.tailoredApplication?.research) {
    return detail.tailoredApplication.research;
  }

  const artifact = detail?.artifacts?.find((item) => item.kind === "research_snapshot");
  if (!artifact?.payload || typeof artifact.payload !== "object") {
    return null;
  }

  const payload = artifact.payload as Partial<JobResearch>;
  return {
    company: payload.company ?? detail?.job?.company ?? "",
    cultureSignals: Array.isArray(payload.cultureSignals) ? payload.cultureSignals : [],
    companyMission: payload.companyMission ?? "",
    companyProducts: Array.isArray(payload.companyProducts) ? payload.companyProducts : [],
    jdSummary: payload.jdSummary ?? "",
    jobUrl: payload.jobUrl ?? detail?.job?.jobUrl ?? "",
    modelDurationMs: payload.modelDurationMs ?? 0,
    niceToHaves: Array.isArray(payload.niceToHaves) ? payload.niceToHaves : [],
    recentNews: Array.isArray(payload.recentNews) ? payload.recentNews : [],
    requirements: Array.isArray(payload.requirements) ? payload.requirements : [],
    responsibilities: Array.isArray(payload.responsibilities) ? payload.responsibilities : [],
    role: payload.role ?? detail?.job?.title ?? "",
    source: payload.source ?? "ingested-description",
    techStack: Array.isArray(payload.techStack) ? payload.techStack : [],
  };
}

function sourceLabel(selected: LiveRecommendation, detail: JobDetail | null | undefined) {
  const sourceSlug = detail?.job?.sourceSlug ?? selected.job?.sourceSlug ?? "";
  if (sourceSlug === "custom-jd" || selected.job?.jobUrl?.startsWith("custom-jd:")) {
    return "Custom JD";
  }
  if (!sourceSlug) {
    return "Ashby";
  }
  const [source] = sourceSlug.split(":");
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function shellClasses(inline: boolean) {
  return inline ? "px-1 pb-1" : "md:sticky md:top-24";
}

function sectionClasses() {
  return "rounded-[24px] border border-white/65 bg-white/78 p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.24)] backdrop-blur-xl";
}

function eyebrowClasses() {
  return "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
}
