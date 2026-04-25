"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

import {
  ActionButton as Button,
  GlassCard,
  Panel,
  StatusBadge as Pill,
  cx,
  mistClasses,
  type StatusTone,
} from "@/components/design-system";
import { mockDLQItems, type DLQItem } from "@/lib/mock-data";
import { formatRelative } from "@/lib/utils";

export default function DLQPage() {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = mockDLQItems.filter((item) => !resolved.has(item.id));
  const resolvedCount = mockDLQItems.length - open.length;

  return (
    <main className={cx("min-h-[calc(100vh-56px)] px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="mx-auto max-w-[1320px] space-y-5">
        <header className={cx("border px-4 py-4 md:px-5", mistClasses.panel)}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="warning">human gate</Pill>
                <Pill tone="neutral">{open.length} open</Pill>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">
                Dead letter queue
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Questions the agent will not guess. Answer once, cache safely, and keep applications moving.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled>
                <RotateCcw className="h-4 w-4" />
                Sync queue
              </Button>
              <Button variant="success" disabled={open.length === 0}>
                <Check className="h-4 w-4" />
                Review ready
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <QueueMetric label="Open" value={open.length} detail="awaiting input" tone={open.length > 0 ? "warning" : "success"} />
          <QueueMetric label="Resolved" value={resolvedCount + 18} detail="cached this week" tone="success" />
          <QueueMetric label="Cache reuse" value={47} detail="answers reused today" tone="accent" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <Panel
            title="Open Items"
            actions={<Pill tone={open.length > 0 ? "warning" : "success"}>{open.length === 0 ? "clear" : "needs review"}</Pill>}
          >
            {open.length === 0 ? (
              <GlassCard className="py-12 text-center">
                <Check className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.5} />
                <div className="mt-4 text-xl font-semibold tracking-[-0.02em] text-slate-950">Inbox zero</div>
                <p className="mt-2 text-sm text-slate-600">No applications need your input right now.</p>
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {open.map((item) => (
                  <DLQCard
                    key={item.id}
                    item={item}
                    draft={drafts[item.id] ?? item.suggestedAnswer ?? ""}
                    setDraft={(value) => setDrafts((current) => ({ ...current, [item.id]: value }))}
                    onResolve={() => setResolved((current) => new Set([...current, item.id]))}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Cache Policy">
            <div className="space-y-3">
              <GlassCard density="compact" variant="selected">
                <div className="text-sm font-semibold text-slate-950">Approval required</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sensitive answers stay paused until you explicitly approve them.
                </p>
              </GlassCard>
              <GlassCard density="compact">
                <div className="text-sm font-semibold text-slate-950">Reuse scope</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cached answers are reused for similar form fields and surfaced in the proof feed.
                </p>
              </GlassCard>
              <GlassCard density="compact">
                <div className="text-sm font-semibold text-slate-950">No final submit</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The final submission gate remains separate from answer caching.
                </p>
              </GlassCard>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function QueueMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <GlassCard density="compact">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-3xl text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/10">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(16, value * 18))}%`,
            backgroundColor: tone === "success" ? "#16A34A" : tone === "warning" ? "#F59E0B" : "#0EA5E9",
          }}
        />
      </div>
    </GlassCard>
  );
}

function DLQCard({
  item,
  draft,
  setDraft,
  onResolve,
}: {
  item: DLQItem;
  draft: string;
  setDraft: (value: string) => void;
  onResolve: () => void;
}) {
  const isQuestion = item.type === "unanswerable_question";
  const tone: StatusTone = isQuestion ? "warning" : "danger";
  const Icon = isQuestion ? AlertTriangle : AlertCircle;

  return (
    <GlassCard variant={isQuestion ? "selected" : "critical"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{isQuestion ? "question" : "submission error"}</Pill>
            <span className="font-mono text-[11px] text-slate-500">{formatRelative(item.raisedAt)}</span>
          </div>
          <Link
            href={`/applications/${item.applicationId}`}
            className="mt-3 inline-flex max-w-full items-center gap-2 text-base font-semibold tracking-[-0.01em] text-slate-950 hover:text-sky-600"
          >
            <span className="truncate">
              {item.company} - {item.role}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>
        <Icon className={cx("h-5 w-5 shrink-0", isQuestion ? "text-amber-600" : "text-red-600")} />
      </div>

      {isQuestion && item.question ? (
        <div className="mt-4 space-y-4">
          <div>
            <div className={mistClasses.sectionLabel}>Question</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.question}</p>
          </div>
          {item.context && (
            <div className="rounded-[18px] border border-white/45 bg-white/28 px-4 py-3">
              <div className="flex items-start gap-2">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-sm leading-6 text-slate-600">{item.context}</p>
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className={mistClasses.sectionLabel}>Answer</div>
              {item.suggestedAnswer && draft === item.suggestedAnswer ? (
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600">
                  Suggested
                </span>
              ) : null}
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={item.suggestedAnswer || "Type your answer..."}
              rows={4}
              className="min-h-28 w-full resize-none rounded-[18px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/15"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-red-500/25 bg-red-500/10 px-4 py-3">
          <p className="text-sm leading-6 text-slate-700">{item.context}</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-white/45 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-xs leading-5 text-slate-500">
          {isQuestion ? "Approving caches this answer for future applications." : "Manual submit will reuse the preserved form state."}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="secondary">
            Skip role
          </Button>
          <Button size="sm" variant={isQuestion ? "success" : "danger"} onClick={onResolve}>
            {isQuestion ? "Approve & cache" : "Mark resolved"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
