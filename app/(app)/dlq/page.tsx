"use client";

import { useState } from "react";
import Link from "next/link";
import { mockDLQItems, type DLQItem } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Database, ArrowRight, Check, ExternalLink } from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function DLQPage() {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = mockDLQItems.filter((i) => !resolved.has(i.id));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-7">
        <h1 className="font-serif text-[36px] leading-tight tracking-tight text-[var(--color-fg)]">
          Dead-letter queue
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)] max-w-xl">
          Questions the agent wouldn't guess. Sponsorship, dates, comp, anything sensitive.
          Each answer is cached and reused on every future application.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        {[
          { label: "Open", value: open.length, hint: "Awaiting your input" },
          { label: "Resolved this week", value: 18, hint: "Cached for reuse" },
          { label: "Cache reuses today", value: 47, hint: "Saved by your past answers" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-surface)] p-5">
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

      {open.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.5} />
            <p className="mt-4 font-serif text-[24px] tracking-tight text-[var(--color-fg)]">
              Inbox zero.
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">
              No applications need your input right now.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {open.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
              >
                <DLQCard
                  item={item}
                  draft={drafts[item.id] || item.suggestedAnswer || ""}
                  setDraft={(v) => setDrafts({ ...drafts, [item.id]: v })}
                  onResolve={() => setResolved(new Set([...resolved, item.id]))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
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
  setDraft: (v: string) => void;
  onResolve: () => void;
}) {
  const isQuestion = item.type === "unanswerable_question";
  return (
    <Card className={cn("overflow-hidden", isQuestion ? "border-amber-500/40" : "border-red-500/40")}>
      <CardHeader className={cn(isQuestion ? "bg-amber-500/10" : "bg-red-500/10")}>
        <div className="flex items-center gap-3">
          {isQuestion ? (
            <AlertTriangle className="h-4 w-4 text-amber-700" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-700" />
          )}
          <div>
            <CardTitle>
              <span className={isQuestion ? "text-amber-700" : "text-red-700"}>
                {isQuestion ? "Unanswerable question" : "Submission error"}
              </span>
              <span className="text-[var(--color-fg-subtle)] mx-2">·</span>
              <Link href={`/applications/${item.applicationId}`} className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
                {item.company} · {item.role}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </CardTitle>
          </div>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {formatRelative(item.raisedAt)}
        </span>
      </CardHeader>
      <CardBody>
        {isQuestion && item.question && (
          <>
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono mb-1.5">
                Question on the form
              </div>
              <p className="text-[14px] text-[var(--color-fg)] leading-relaxed">
                {item.question}
              </p>
            </div>
            {item.context && (
              <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Database className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-fg-subtle)]" />
                  <p className="text-[12px] text-[var(--color-fg-muted)] leading-relaxed">
                    {item.context}
                  </p>
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
                  Your answer
                </div>
                {item.suggestedAnswer && draft === item.suggestedAnswer && (
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)] font-mono">
                    Suggested
                  </span>
                )}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={item.suggestedAnswer || "Type your answer…"}
                rows={3}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none focus:border-[var(--color-accent)] resize-none"
              />
            </div>
          </>
        )}
        {!isQuestion && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <p className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
              {item.context}
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
            {isQuestion ? "Approving caches this answer for every future Ashby app." : "Manual submit will reuse the form state."}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm">
              Skip role
            </Button>
            <Button variant="accent" size="sm" onClick={onResolve}>
              {isQuestion ? "Approve & cache" : "Mark resolved"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
