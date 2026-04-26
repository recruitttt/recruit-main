"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
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
import { cn, formatRelative } from "@/lib/utils";

type PersistedDLQItem = DLQItem & {
  status: "open" | "cached" | "skipped" | "resolved";
  answer?: string;
  resolvedAt?: string;
};

type QueuePayload = {
  items: PersistedDLQItem[];
  openCount: number;
  resolvedCount: number;
};

export default function DLQPage() {
  const [queue, setQueue] = useState<QueuePayload>({
    items: mockDLQItems.map((item) => ({ ...item, status: "open" })),
    openCount: mockDLQItems.length,
    resolvedCount: 0,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyItem, setBusyItem] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const open = queue.items.filter((item) => item.status === "open");
  const resolvedCount = queue.resolvedCount;

  const loadQueue = useCallback(async () => {
    try {
      setError(undefined);
      const response = await fetch("/api/dlq", { cache: "no-store" });
      const body = await response.json().catch(() => null) as QueuePayload | { message?: string } | null;
      if (!response.ok || !body || !("items" in body)) {
        throw new Error(body && "message" in body ? body.message : `dlq_${response.status}`);
      }
      setQueue(body);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of body.items) {
          if (next[item.id] === undefined) next[item.id] = item.answer ?? item.suggestedAnswer ?? "";
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(id);
  }, [loadQueue]);

  async function mutateQueue(itemId: string, action: "approve-cache" | "skip-role" | "mark-resolved") {
    try {
      setBusyItem(itemId);
      setError(undefined);
      setMessage(action === "approve-cache" ? "Caching answer..." : action === "skip-role" ? "Skipping role..." : "Resolving item...");
      const response = await fetch("/api/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId, answer: drafts[itemId] ?? "" }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; queue?: QueuePayload; message?: string } | null;
      if (!response.ok || !body?.ok || !body.queue) {
        throw new Error(body?.message ?? `dlq_update_${response.status}`);
      }
      setQueue(body.queue);
      setMessage(action === "approve-cache" ? "Answer cached for future applications." : "Queue decision saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage(undefined);
    } finally {
      setBusyItem(undefined);
    }
  }

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
                Review queue
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Questions the agent will not guess. Answer once, cache safely, and keep applications moving.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadQueue()} disabled={loading}>
                <RotateCcw className="h-4 w-4" />
                Sync queue
              </Button>
              <Button variant="success" disabled>
                <Check className="h-4 w-4" />
                Review ready
              </Button>
            </div>
          </div>
          {(message || error) && (
            <div className={cx(
              "mt-4 rounded-[16px] border px-3 py-2 text-xs leading-5",
              error ? "border-red-300/55 bg-red-50/45 text-red-700" : "border-white/45 bg-white/30 text-slate-600"
            )}>
              {error ?? message}
            </div>
          )}
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
              <div className="rounded-[20px] border border-white/50 bg-white/45 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.5} />
                <div className="mt-4 text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-950">
                  No blockers right now
                </div>
                <p className="mt-2 text-sm leading-snug text-slate-600">
                  Great — nothing needs your review. Failed jobs and questions will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {open.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(index, 8) * 0.04,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <DLQCard
                      item={item}
                      draft={drafts[item.id] ?? item.suggestedAnswer ?? ""}
                      setDraft={(value) => setDrafts((current) => ({ ...current, [item.id]: value }))}
                      busy={busyItem === item.id}
                      onSkip={() => void mutateQueue(item.id, "skip-role")}
                      onResolve={() => void mutateQueue(item.id, item.type === "unanswerable_question" ? "approve-cache" : "mark-resolved")}
                    />
                  </motion.div>
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
  busy,
  onSkip,
  onResolve,
}: {
  item: PersistedDLQItem;
  draft: string;
  setDraft: (value: string) => void;
  busy: boolean;
  onSkip: () => void;
  onResolve: () => void;
}) {
  const isQuestion = item.type === "unanswerable_question";
  const tone: StatusTone = isQuestion ? "warning" : "danger";
  const Icon = isQuestion ? AlertTriangle : AlertCircle;

  return (
    <GlassCard
      variant={isQuestion ? "selected" : "critical"}
      className={cn("transition-colors duration-150 hover:bg-white/60", !busy && "cursor-pointer")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{isQuestion ? "question" : "submission error"}</Pill>
            <span className="font-mono text-[11px] text-slate-500">{formatRelative(item.raisedAt)}</span>
          </div>
          <div className="mt-3 inline-flex max-w-full items-center gap-2 text-base font-semibold leading-tight tracking-[-0.01em] text-slate-950">
            <span className="truncate">
              {item.company} - {item.role}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
            application detail deprecated
          </div>
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
              className="min-h-28 w-full resize-none rounded-[18px] border border-white/55 bg-white/36 px-4 py-2.5 text-sm leading-snug text-slate-800 outline-none placeholder:leading-snug placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-400/30"
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
          <Button size="sm" variant="secondary" onClick={onSkip} disabled={busy}>
            Skip role
          </Button>
          <Button size="sm" variant={isQuestion ? "success" : "danger"} onClick={onResolve} disabled={busy}>
            {isQuestion ? "Approve & cache" : "Mark resolved"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
