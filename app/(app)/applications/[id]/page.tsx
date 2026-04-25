import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileText,
  Play,
  ShieldCheck,
} from "lucide-react";

import { getApplicationDetail, type ApplicationDetailEvent } from "@/lib/application-detail";
import { stageLabels, stageOrder } from "@/lib/mock-data";
import { formatRelative, cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/logo";
import { StageBadge, Pill } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const sourceLabels = {
  resume: "Resume",
  settings: "Settings",
  cache: "Cache hit",
  model: "Model",
  user: "You answered",
};

const sourceColors = {
  resume: "text-cyan-700 border-cyan-500/30 bg-cyan-500/10",
  settings: "text-violet-700 border-violet-500/30 bg-violet-500/10",
  cache: "text-emerald-700 border-emerald-500/30 bg-emerald-500/10",
  model: "text-amber-700 border-amber-500/30 bg-amber-500/10",
  user: "text-[var(--color-fg-muted)] border-[var(--color-border-strong)] bg-[var(--color-surface-1)]",
};

const verdictColors = {
  Strong: "text-emerald-700",
  "On the line": "text-amber-700",
  Weak: "text-red-700",
};

const eventColors: Record<ApplicationDetailEvent["level"], string> = {
  info: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  error: "bg-red-500/10 text-red-700 border-red-500/30",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getApplicationDetail(id);
  const currentStageIndex = Math.max(stageOrder.indexOf(app.stage), 0);
  const sourceTone = app.source === "live" ? "success" : app.source === "fallback" ? "warn" : "accent";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-1.5 text-[12px] font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
      >
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>

      {app.notice && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] leading-5 text-amber-700">
          {app.notice}
        </div>
      )}

      <div className="mb-7 flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyLogo bg={app.logoBg} text={app.logoText} size={56} className="rounded-xl" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-[32px] leading-tight tracking-tight text-[var(--color-fg)]">
                {app.role}
              </h1>
              <StageBadge stage={app.stage} pulse={app.source === "live"} />
              <Pill tone={sourceTone}>{app.source}</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--color-fg-muted)]">
              <span className="font-medium text-[var(--color-fg)]">{app.company}</span>
              <span>·</span>
              <span>{app.location}</span>
              {app.salaryRange && (
                <>
                  <span>·</span>
                  <span>{app.salaryRange}</span>
                </>
              )}
              <span>·</span>
              <Pill tone="accent">via {app.provider}</Pill>
            </div>
            {app.jobUrl === "#" ? (
              <div className="mt-2 text-[12px] font-mono text-[var(--color-fg-subtle)]">
                live id: {app.id}
              </div>
            ) : (
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)]"
              >
                <span className="truncate">{app.jobUrl}</span> <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {app.pdfDownloadUrl ? (
            <a
              href={app.pdfDownloadUrl}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </a>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled
              title={app.artifacts.some((artifact) => artifact.kind === "file") ? "PDF metadata is persisted, but downloadable bytes are not available for this older run." : "No tailored resume PDF is available."}
            >
              <Download className="h-3.5 w-3.5" /> {app.artifacts.some((artifact) => artifact.kind === "file") ? "PDF metadata stored" : "Resume PDF unavailable"}
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled title="Replay artifacts are not persisted for this application yet.">
            <Play className="h-3.5 w-3.5" /> Replay unavailable
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-4">
        {[
          { label: "Match score", value: scoreValue(app.matchScore), hint: "JD vs intake" },
          { label: "Tailoring score", value: scoreValue(app.tailoringScore), hint: "Resume rewrite quality" },
          { label: "Questions", value: app.questionSummary.split(" ")[0] ?? "seeded", hint: app.questionSummary },
          { label: "Cache reuses", value: app.cacheReuseCount ?? "pending", hint: app.cacheReuseCount === null ? "Provider cache data pending" : "Saved this run" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-surface)] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)]">
              {s.label}
            </div>
            <div className="mt-2 font-serif text-[28px] leading-none tracking-tight text-[var(--color-fg)] tabular-nums">
              {s.value}
            </div>
            <div className="mt-2 line-clamp-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
              {s.hint}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Run timeline</CardTitle>
              <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                Started {formatRelative(app.startedAt)}
              </span>
            </CardHeader>
            <CardBody>
              <div className="flex items-center justify-between">
                {stageOrder.map((s, i) => {
                  const done = i < currentStageIndex;
                  const active = i === currentStageIndex;
                  return (
                    <div key={s} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-mono transition-colors",
                            done && "border-emerald-500/50 bg-emerald-500/15 text-emerald-700",
                            active && "border-cyan-500/50 bg-cyan-500/15 text-cyan-700 ring-2 ring-cyan-500/25",
                            !done && !active && "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-subtle)]"
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
                        </div>
                        <div
                          className={cn(
                            "mt-2 font-mono text-[10px] uppercase tracking-[0.15em]",
                            done || active ? "text-[var(--color-fg)]" : "text-[var(--color-fg-subtle)]"
                          )}
                        >
                          {stageLabels[s]}
                        </div>
                      </div>
                      {i < stageOrder.length - 1 && (
                        <div className={cn("mx-2 mb-6 h-px flex-1", done ? "bg-emerald-500/40" : "bg-[var(--color-border)]")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Browser session</CardTitle>
              <div className="flex items-center gap-2">
                <Pill tone={app.browserEvidence.tone === "Recorded" ? "success" : "warn"}>
                  {app.browserEvidence.tone}
                </Pill>
                <Button variant="ghost" size="sm" disabled title="Replay artifacts are not persisted for this application yet.">
                  <Play className="h-3 w-3" /> Watch unavailable
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="relative flex aspect-[16/9] items-center justify-center border-t border-[var(--color-border)] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-2)]">
                <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2 backdrop-blur">
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="ml-2 flex h-5 min-w-0 items-center rounded bg-[var(--color-bg)] px-2 text-[10px] font-mono text-[var(--color-fg-subtle)]">
                    <span className="truncate">{app.jobUrl === "#" ? app.id : app.jobUrl}</span>
                  </div>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "pulse-soft 2s ease-in-out infinite" }} />
                    Browserbase · {app.browserEvidence.tone}
                  </span>
                </div>
                <div className="px-6 text-center font-mono text-[12px] text-[var(--color-fg-subtle)]">
                  <div className="text-[var(--color-fg-muted)]">{app.browserEvidence.label}</div>
                  <div className="mt-1 text-[10px] leading-5">{app.browserEvidence.detail}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Mapped questions{" "}
                <span className="ml-2 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                  {app.questionSummary}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[var(--color-border)]">
                {app.questions.length === 0 ? (
                  <div className="px-5 py-4 text-[12px] leading-5 text-[var(--color-fg-muted)]">
                    Live provider questions have not been captured for this application.
                  </div>
                ) : app.questions.map((q) => (
                  <div key={q.id} className="px-5 py-3.5">
                    <div className="mb-1.5 flex items-start justify-between gap-3">
                      <div className="text-[13px] text-[var(--color-fg)]">{q.label}</div>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", sourceColors[q.source])}>
                        {sourceLabels[q.source]}
                      </span>
                    </div>
                    <div className="font-mono text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{q.answer}</div>
                    <div className="mt-1.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">{q.canonicalKey}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event log</CardTitle>
              <Pill tone={app.source === "live" ? "success" : "neutral"}>{app.source === "live" ? "convex" : "seeded"}</Pill>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[var(--color-border)]">
                {app.events.map((event) => (
                  <div key={event.id} className="grid gap-3 px-5 py-3.5 md:grid-cols-[96px_1fr_auto]">
                    <div className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{formatEventTime(event.time)}</div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)]">{event.stage}</div>
                      <div className="mt-1 text-[13px] leading-5 text-[var(--color-fg-muted)]">{event.message}</div>
                    </div>
                    <span className={cn("h-fit rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", eventColors[event.level])}>
                      {event.evidence ?? event.level}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit evidence</CardTitle>
              <Pill tone={app.submitEvidence.tone}>{app.submitEvidence.status}</Pill>
            </CardHeader>
            <CardBody>
              <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--color-fg-muted)]" />
                <p className="text-[12px] leading-5 text-[var(--color-fg-muted)]">{app.submitEvidence.detail}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3-persona review</CardTitle>
              <Pill tone="accent">PASS</Pill>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[var(--color-border)]">
                {app.personaReviews.length === 0 ? (
                  <div className="px-5 py-4 text-[12px] leading-5 text-[var(--color-fg-muted)]">
                    Live persona review is not captured for this application.
                  </div>
                ) : app.personaReviews.map((r) => (
                  <div key={r.persona} className="px-5 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[12px] font-medium text-[var(--color-fg)]">{r.persona}</div>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-[10px] uppercase tracking-[0.15em]", verdictColors[r.verdict])}>{r.verdict}</span>
                        <span className="font-mono text-[14px] text-[var(--color-fg)] tabular-nums">{r.score}</span>
                      </div>
                    </div>
                    <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{r.notes}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {app.artifacts.map((artifact) => (
                <div key={`${artifact.title}-${artifact.meta}`} className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <FileText className="h-5 w-5 text-[var(--color-fg-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-[var(--color-fg)]">{artifact.title}</div>
                    <div className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{artifact.meta}</div>
                  </div>
                  <Pill tone={artifact.kind === "file" ? "success" : "neutral"}>{artifact.kind}</Pill>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                {app.summary.map((item) => (
                  <div key={item.label} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{item.label}</div>
                    <div className="mt-1 truncate text-[var(--color-fg)]">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function scoreValue(value: number | null): string {
  if (value === null) return "pending";
  return `${Math.round(value)}%`;
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
