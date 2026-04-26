"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, ExternalLink, Eye, FileText, Loader2, Sparkles } from "lucide-react";
import { ActionButton, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion-presets";
import type { JobResearch } from "@/lib/tailor/types";
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
  const reduceMotion = useReducedMotion();

  return (
    <section className={shellClasses(inline)}>
      <AnimatePresence mode="wait" initial={false}>
        {!selected ? (
          <motion.div
            key="empty"
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 24 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 240, damping: 28, mass: 0.7 }
            }
            className="rounded-[18px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)]">
              <FileText className="h-5 w-5 text-[var(--color-fg-subtle)]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[var(--color-fg)]">
              Pick an application
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
              Open a row to review the role and next action.
            </p>
          </motion.div>
        ) : (
          <InspectorBody
            key={selected.jobId}
            selected={selected}
            detail={detail}
            detailError={detailError}
            state={state}
            pdf={pdf}
            reduceMotion={Boolean(reduceMotion)}
            onTailor={onTailor}
            onOpenPdf={onOpenPdf}
            onDownload={onDownload}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function InspectorBody({
  selected,
  detail,
  detailError,
  state,
  pdf,
  reduceMotion,
  onTailor,
  onOpenPdf,
  onDownload,
}: {
  selected: LiveRecommendation;
  detail: JobDetail | null | undefined;
  detailError?: string;
  state: TailorState;
  pdf: DashboardJobInspectorProps["pdf"];
  reduceMotion: boolean;
  onTailor: () => void;
  onOpenPdf: () => void;
  onDownload: () => void;
}) {
  const loading = detail === undefined;
  const job = detail?.job ?? selected.job ?? null;
  const resolvedJobUrl = job?.jobUrl ?? selected.jobUrl;
  const resolvedTitle = job?.title ?? selected.title;
  const resolvedCompany = job?.company ?? selected.company;
  const resolvedLocation = job?.location ?? selected.location;
  const strengths = detail?.score?.strengths ?? selected.strengths ?? [];
  const risks = detail?.score?.risks ?? selected.risks ?? [];
  const rationale = detail?.score?.rationale ?? selected.rationale ?? "No fit summary recorded yet.";
  const research = readResearch(detail);
  const tailored = detail?.tailoredApplication;
  const importantFacts = [
    { label: "Location", value: resolvedLocation },
    { label: "Compensation", value: job?.compensationSummary ?? selected.compensationSummary },
    { label: "Source", value: sourceLabel(selected, detail) },
    { label: "Team", value: detail?.job?.team ?? detail?.job?.department },
  ].filter((fact) => Boolean(fact.value));

  const score = detail?.score?.totalScore ?? selected.score;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 240, damping: 28, mass: 0.7 }
      }
      className="space-y-4"
    >
      <motion.section
        variants={reduceMotion ? undefined : fadeUp}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={state.error ? "danger" : tailored?.status === "completed" ? "success" : "neutral"}>
                {state.error ? "Needs attention" : tailored?.status === "completed" ? "Ready" : "Open"}
              </StatusBadge>
              {loading ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-[var(--color-accent)]" /> : null}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-fg)]">
              {resolvedTitle}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-fg-muted)]">
              <span className="font-medium text-[var(--color-fg)]">{resolvedCompany}</span>
              {resolvedLocation ? <span>{resolvedLocation}</span> : null}
              {Number.isFinite(score) ? (
                <motion.span
                  key={score}
                  initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
                  animate={{ scale: [0.92, 1.06, 1], opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.5, ease: [0.22, 1, 0.36, 1], times: [0, 0.5, 1] }
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-fg)]"
                >
                  Fit {Math.round(score)}
                </motion.span>
              ) : null}
            </div>
          </div>

          <a
            href={resolvedJobUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-fg-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Original
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </motion.section>

      {detailError ? (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {detailError}
        </motion.section>
      ) : null}

      <motion.div
        variants={reduceMotion ? undefined : staggerContainer(0.06)}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="space-y-4"
      >
        <motion.section variants={reduceMotion ? undefined : staggerItem} className={sectionClasses()}>
          <div className={eyebrowClasses()}>Next action</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton onClick={onTailor} disabled={loading || state.running}>
              {state.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tailor
            </ActionButton>
            <ActionButton variant="secondary" onClick={onOpenPdf} disabled={!pdf.canView}>
              <Eye className="h-4 w-4" />
              View PDF
            </ActionButton>
            <ActionButton variant="secondary" onClick={onDownload} disabled={!pdf.canDownload}>
              <Download className="h-4 w-4" />
              Download
            </ActionButton>
          </div>

          <div
            className={cn(
              "mt-4 rounded-[14px] border px-4 py-3 text-sm leading-6",
              state.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]",
            )}
          >
            {state.error ?? state.message}
            {pdf.filename ? (
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                {pdf.filename}
                {pdf.sizeKb ? ` · ${pdf.sizeKb} KB` : ""}
              </div>
            ) : null}
          </div>
        </motion.section>

        <motion.section variants={reduceMotion ? undefined : staggerItem} className={sectionClasses()}>
          <div className={eyebrowClasses()}>Fit summary</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-fg-muted)]">{rationale}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BulletColumn title="Strengths" items={strengths} emptyLabel="No strengths captured yet." tone="emerald" reduceMotion={reduceMotion} />
            <BulletColumn title="Risks" items={risks} emptyLabel="No risks captured yet." tone="amber" reduceMotion={reduceMotion} />
          </div>
        </motion.section>

        {importantFacts.length > 0 ? (
          <motion.section variants={reduceMotion ? undefined : staggerItem} className={sectionClasses()}>
            <div className={eyebrowClasses()}>Job facts</div>
            <dl className="mt-4 divide-y divide-[var(--color-border)]">
              {importantFacts.map((fact) => (
                <div key={fact.label} className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm">
                  <dt className="text-[var(--color-fg-subtle)]">{fact.label}</dt>
                  <dd className="text-[var(--color-fg)]">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </motion.section>
        ) : null}

        <motion.details variants={reduceMotion ? undefined : staggerItem} className={detailsClasses()}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-fg)]">
            Research notes
          </summary>
          {research ? (
            <div className="mt-4 space-y-4">
              {research.jdSummary ? (
                <p className="text-sm leading-7 text-[var(--color-fg-muted)]">{research.jdSummary}</p>
              ) : null}
              <ResearchList title="Requirements" items={research.requirements} />
              <ResearchList title="Tech stack" items={research.techStack} />
              <ResearchList title="Culture signals" items={research.cultureSignals} />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--color-fg-subtle)]">
              Research notes appear after tailoring.
            </p>
          )}
        </motion.details>

        <motion.details variants={reduceMotion ? undefined : staggerItem} className={detailsClasses()}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-fg)]">
            Captured description
          </summary>
          <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-sm leading-7 text-[var(--color-fg-muted)]">
            {(job?.descriptionPlain ?? selected.job?.descriptionPlain)?.trim() || "No captured description for this role yet."}
          </div>
        </motion.details>
      </motion.div>
    </motion.div>
  );
}

function BulletColumn({
  title,
  items,
  emptyLabel,
  tone,
  reduceMotion,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "emerald" | "amber";
  reduceMotion: boolean;
}) {
  const dotClasses = tone === "emerald" ? "bg-[var(--color-success)]" : "bg-amber-500";

  return (
    <div>
      <div className="text-xs font-semibold text-[var(--color-fg)]">{title}</div>
      {items.length > 0 ? (
        <motion.ul
          variants={reduceMotion ? undefined : staggerContainer(0.05)}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="mt-3 space-y-2"
        >
          {items.slice(0, 4).map((item) => (
            <motion.li
              key={item}
              variants={reduceMotion ? undefined : staggerItem}
              className="flex gap-2 text-sm leading-6 text-[var(--color-fg-muted)]"
            >
              <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dotClasses)} />
              <span>{item}</span>
            </motion.li>
          ))}
        </motion.ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--color-fg-subtle)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function ResearchList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-[var(--color-fg)]">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <li key={`${title}-${item}`} className="flex gap-2 text-sm leading-6 text-[var(--color-fg-muted)]">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
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
  return "rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5";
}

function detailsClasses() {
  return "rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4";
}

function eyebrowClasses() {
  return "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]";
}
