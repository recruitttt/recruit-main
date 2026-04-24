import { notFound } from "next/navigation";
import Link from "next/link";
import {
  mockApplications,
  mockMappedQuestions,
  mockPersonaReviews,
  stageOrder,
  stageLabels,
  type Stage,
} from "@/lib/mock-data";
import { CompanyLogo } from "@/components/ui/logo";
import { StageBadge, Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, FileText, Download, Play, Check } from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  resume: "Resume",
  settings: "Settings",
  cache: "Cache hit",
  model: "Model",
  user: "You answered",
};

const sourceColors: Record<string, string> = {
  resume: "text-cyan-700 border-cyan-500/30 bg-cyan-500/10",
  settings: "text-violet-700 border-violet-500/30 bg-violet-500/10",
  cache: "text-emerald-700 border-emerald-500/30 bg-emerald-500/10",
  model: "text-amber-700 border-amber-500/30 bg-amber-500/10",
  user: "text-[var(--color-fg-muted)] border-[var(--color-border-strong)] bg-[var(--color-surface-1)]",
};

const verdictColors: Record<string, string> = {
  Strong: "text-emerald-700",
  "On the line": "text-amber-700",
  Weak: "text-red-700",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = mockApplications.find((a) => a.id === id);
  if (!app) notFound();

  const currentStageIndex = stageOrder.indexOf(app.stage);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] font-mono"
      >
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>

      {/* header */}
      <div className="mb-7 flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <CompanyLogo bg={app.logoBg} text={app.logoText} size={56} className="rounded-xl" />
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-serif text-[32px] leading-tight tracking-tight text-[var(--color-fg)]">
                {app.role}
              </h1>
              <StageBadge stage={app.stage} pulse />
            </div>
            <div className="flex items-center gap-3 text-[13px] text-[var(--color-fg-muted)]">
              <span className="font-medium text-[var(--color-fg)]">{app.company}</span>
              <span>·</span>
              <span>{app.location}</span>
              {app.salaryRange && <><span>·</span><span>{app.salaryRange}</span></>}
              <span>·</span>
              <Pill tone="accent">via {app.provider}</Pill>
            </div>
            <a
              href={app.jobUrl}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)]"
            >
              {app.jobUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm">
            <Download className="h-3.5 w-3.5" /> Resume PDF
          </Button>
          <Button variant="secondary" size="sm">
            <Play className="h-3.5 w-3.5" /> Replay run
          </Button>
        </div>
      </div>

      {/* score strip */}
      <div className="mb-6 grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden md:grid-cols-4">
        {[
          { label: "Match score", value: app.matchScore, hint: "JD vs intake" },
          { label: "Tailoring score", value: app.tailoringScore || "—", hint: "Resume rewrite quality" },
          { label: "Questions filled", value: "14/14", hint: "Including DLQ approvals" },
          { label: "Cache reuses", value: 7, hint: "Saved this run" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-surface)] p-4">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
              {s.label}
            </div>
            <div className="mt-2 text-[28px] font-serif tracking-tight text-[var(--color-fg)] tabular-nums leading-none">
              {s.value}
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-fg-subtle)] font-mono">
              {s.hint}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left column: timeline + browser preview */}
        <div className="space-y-6 lg:col-span-2">
          {/* status timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Run timeline</CardTitle>
              <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
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
                            done && "bg-emerald-500/15 border-emerald-500/50 text-emerald-700",
                            active && "bg-cyan-500/15 border-cyan-500/50 text-cyan-700 ring-2 ring-cyan-500/25",
                            !done && !active && "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-fg-subtle)]"
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
                        </div>
                        <div
                          className={cn(
                            "mt-2 text-[10px] uppercase tracking-[0.15em] font-mono",
                            (done || active) ? "text-[var(--color-fg)]" : "text-[var(--color-fg-subtle)]"
                          )}
                        >
                          {stageLabels[s]}
                        </div>
                      </div>
                      {i < stageOrder.length - 1 && (
                        <div
                          className={cn(
                            "h-px flex-1 mx-2 mb-6",
                            done ? "bg-emerald-500/40" : "bg-[var(--color-border)]"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* browser session preview */}
          <Card>
            <CardHeader>
              <CardTitle>Browser session</CardTitle>
              <div className="flex items-center gap-2">
                <Pill tone="success">Recorded</Pill>
                <Button variant="ghost" size="sm">
                  <Play className="h-3 w-3" /> Watch replay
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="relative aspect-[16/9] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-2)] flex items-center justify-center border-t border-[var(--color-border)]">
                <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2 backdrop-blur">
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="h-2 w-2 rounded-full bg-[var(--color-surface-2)]" />
                  <div className="ml-2 flex h-5 items-center rounded bg-[var(--color-bg)] px-2 text-[10px] text-[var(--color-fg-subtle)] font-mono">
                    {app.jobUrl}
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-700 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{animation: "pulse-soft 2s ease-in-out infinite"}} />
                    Browserbase · Live
                  </span>
                </div>
                <div className="text-center text-[var(--color-fg-subtle)] text-[12px] font-mono">
                  Browserbase session preview
                  <div className="mt-1 text-[10px]">[ recording playback ]</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* mapped questions */}
          <Card>
            <CardHeader>
              <CardTitle>Mapped questions <span className="text-[var(--color-fg-subtle)] font-mono ml-2 text-[11px]">14 of 14 resolved</span></CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[var(--color-border)]">
                {mockMappedQuestions.map((q) => (
                  <div key={q.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="text-[13px] text-[var(--color-fg)]">
                        {q.label}
                      </div>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-mono", sourceColors[q.source])}>
                        {sourceLabels[q.source]}
                      </span>
                    </div>
                    <div className="text-[12px] text-[var(--color-fg-muted)] leading-relaxed font-mono">
                      {q.answer}
                    </div>
                    <div className="mt-1.5 text-[10px] text-[var(--color-fg-subtle)] font-mono">
                      {q.canonicalKey}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* right column: persona reviews + log */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>3-persona review</CardTitle>
              <Pill tone="accent">PASS</Pill>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[var(--color-border)]">
                {mockPersonaReviews.map((r) => (
                  <div key={r.persona} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-medium text-[var(--color-fg)]">
                        {r.persona}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] uppercase tracking-[0.15em] font-mono", verdictColors[r.verdict])}>
                          {r.verdict}
                        </span>
                        <span className="font-mono text-[14px] text-[var(--color-fg)] tabular-nums">
                          {r.score}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] text-[var(--color-fg-muted)] leading-relaxed">
                      {r.notes}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resume artifact</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-[var(--color-fg-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--color-fg)] truncate">
                    mo-hoshir-{app.company.toLowerCase()}.pdf
                  </div>
                  <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                    Tailored · 2 pages · 184KB
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-2">
                  <div className="text-[var(--color-fg-subtle)] uppercase tracking-wider text-[10px]">Bullets reordered</div>
                  <div className="mt-1 text-[var(--color-fg)]">7</div>
                </div>
                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-2">
                  <div className="text-[var(--color-fg-subtle)] uppercase tracking-wider text-[10px]">Skills emphasized</div>
                  <div className="mt-1 text-[var(--color-fg)]">+4</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
