"use client";

//
// EnrichmentChat — follow-up Q&A surface that lives in the Ready Room while
// the rest of the intake pipelines finish. Asks 4-6 short questions, one at
// a time, and round-trips each user reply through `runChatIntake` so the
// resulting field patches merge into `userProfiles`.
//
// Re-uses the chat primitives from `components/onboarding/chat.tsx` and the
// AgentCharacter avatars so the page feels native to the onboarding flow.
//

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { api } from "@/convex/_generated/api";
import {
  ActionButton,
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { TypingIndicator, UserMessage } from "@/components/onboarding/chat";
import { logProfileEvent } from "@/lib/profile";

interface EnrichmentChatProps {
  userId: string;
}

interface FollowupQuestion {
  /** Stable id so React keys stay stable as we cycle through questions. */
  id: string;
  /** What Scout asks. */
  prompt: string;
  /** Top-level UserProfile field paths the LLM should try to extract. */
  extractTargets: string[];
  /** Helper text or example shown under the input. */
  hint?: string;
}

const FOLLOWUPS: ReadonlyArray<FollowupQuestion> = [
  {
    id: "company-size",
    prompt:
      "What kind of company size do you thrive in — early-stage scrappy, mid-size with structure, or big-co stability?",
    extractTargets: ["prefs"],
    hint: "I'll filter the search to roles that match.",
  },
  {
    id: "dream-blocked",
    prompt:
      "Any companies you'd love to work for, or any you'd refuse? Just say a few names off the top of your head.",
    extractTargets: ["prefs"],
    hint: "Loved + blocked lists feed the ranker directly.",
  },
  {
    id: "work-mode",
    prompt:
      "What's your ideal work mode — remote, hybrid, or in-office? Cities you'd actually move to count too.",
    extractTargets: ["prefs", "location"],
  },
  {
    id: "proud-project",
    prompt:
      "Tell me about a project you're most proud of. What did you ship, and why does it matter?",
    extractTargets: ["summary", "experience"],
    hint: "I'll quote it back when tailoring resumes.",
  },
  {
    id: "headline",
    prompt:
      "If a recruiter only read one line about you, what should it say?",
    extractTargets: ["headline"],
  },
];

type ChatEntry =
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "user"; text: string };

export function EnrichmentChat({
  userId,
}: EnrichmentChatProps): React.ReactElement {
  const runChatIntake = useAction(api.intakeActions.runChatIntake);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [messages, setMessages] = useState<ChatEntry[]>(() => [
    {
      id: "a-0",
      kind: "agent",
      text: FOLLOWUPS[0]?.prompt ?? "",
    },
  ]);

  const currentQuestion = FOLLOWUPS[questionIndex];
  const remaining = FOLLOWUPS.length - questionIndex - 1;
  const finished = questionIndex >= FOLLOWUPS.length;

  // Auto-scroll the chat as new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const canSubmit = useMemo(
    () => Boolean(reply.trim()) && !submitting && !finished,
    [reply, submitting, finished],
  );

  async function handleSubmit() {
    if (!canSubmit || !currentQuestion) return;
    const text = reply.trim();
    if (!text) return;

    const nextHistory: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history,
      { role: "assistant", content: currentQuestion.prompt },
      { role: "user", content: text },
    ];

    setReply("");
    setSubmitting(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `u-${current.length}`, kind: "user", text },
    ]);
    setTyping(true);

    try {
      await runChatIntake({
        userId,
        messages: nextHistory,
        extractTargets: currentQuestion.extractTargets,
      });
      logProfileEvent("chat", `Enrichment answer captured (${currentQuestion.id})`, "success");
      setHistory(nextHistory);

      const nextIndex = questionIndex + 1;
      const nextQ = FOLLOWUPS[nextIndex];

      // Brief delay so the typing indicator feels real.
      window.setTimeout(() => {
        setTyping(false);
        setQuestionIndex(nextIndex);
        if (nextQ) {
          setMessages((current) => [
            ...current,
            {
              id: `a-${current.length}-${nextQ.id}`,
              kind: "agent",
              text: nextQ.prompt,
            },
          ]);
        } else {
          setMessages((current) => [
            ...current,
            {
              id: `a-${current.length}-done`,
              kind: "agent",
              text:
                "Got it. That gives me enough to ground every job match. You're good to start the search whenever you are.",
            },
          ]);
        }
      }, 380);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setTyping(false);
      logProfileEvent("chat", "Enrichment chat failed", "error", { message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-start gap-3 border-b border-[var(--glass-border)] pb-4">
        <AgentCharacter id="scout" awake size={44} />
        <div className="min-w-0 flex-1">
          <div className={cx(mistClasses.sectionLabel, "text-[var(--color-accent)]")}>
            Scout enrichment
          </div>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--color-fg)]">
            A few quick questions while we wait.
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--color-fg-muted)]">
            Each answer sharpens the ranker. {finished ? "You're all set." : `~${remaining + 1} left.`}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[360px] min-h-[220px] space-y-4 overflow-y-auto pr-1"
      >
        {messages.map((message) =>
          message.kind === "agent" ? (
            <ScoutLine key={message.id}>{message.text}</ScoutLine>
          ) : (
            <UserMessage key={message.id}>{message.text}</UserMessage>
          ),
        )}
        {typing && <TypingIndicator from="scout" />}
      </div>

      {!finished && (
        <div className={cx("mt-4 space-y-2 border-t border-[var(--glass-border)] pt-4")}>
          <div
            className={cx(
              "flex flex-wrap items-end gap-2 border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] p-2",
              mistRadii.nested,
            )}
          >
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={reply}
                placeholder="Type your answer…"
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                className="h-9 w-full border-0 bg-transparent px-2 text-sm leading-none text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-0"
              />
            </div>
            <ActionButton
              variant="primary"
              size="md"
              loading={submitting}
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              Send <ArrowRight className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
          {currentQuestion?.hint && (
            <p className="pl-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {currentQuestion.hint}
            </p>
          )}
          {error && (
            <p className="pl-1 text-xs leading-5 text-[var(--color-danger)]">{error}</p>
          )}
        </div>
      )}

      {finished && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cx(
              "mt-4 flex items-center gap-2 border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3 py-2 text-[var(--color-success)]",
              mistRadii.nested,
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">All follow-ups captured.</span>
          </motion.div>
        </AnimatePresence>
      )}
    </GlassCard>
  );
}

function ScoutLine({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <div className="flex w-8 shrink-0 justify-center">
        <AgentCharacter id="scout" awake size={36} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 text-[13px] font-medium tracking-tight text-[var(--color-accent)]">
          Scout
        </div>
        <div className="text-[15px] leading-snug text-[var(--color-fg)]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
