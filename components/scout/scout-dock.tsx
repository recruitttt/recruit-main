"use client";

//
// Scout dock — floating "Ask Scout" pill that expands into a full chat
// surface. Optional everywhere, never blocking the main flow. Streams
// from /api/scout/chat with prompt caching server-side.
//

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, MessageCircle, Square, X } from "lucide-react";
import {
  ActionButton,
  TextField,
  cx,
  mistColors,
  mistRadii,
} from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import {
  useScoutChat,
  type ScoutMessage,
  type ToolHint,
} from "@/components/scout/use-scout-chat";

export interface ScoutDockProps {
  userId: string | null;
  surface: "onboarding" | "ready" | "dashboard";
  /**
   * If true, the dock is suppressed entirely (e.g., user opted out in settings).
   */
  disabled?: boolean;
  /** Optional handler when the LLM suggests a step transition. */
  onSuggestStep?: (target: ToolHint["targetStep"]) => void;
}

const COLLAPSED_FLAG = "recruit:scout-dock-collapsed";

export function ScoutDock({
  userId,
  surface,
  disabled,
  onSuggestStep,
}: ScoutDockProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useScoutChat({
    userId: userId ?? "",
    surface,
  });

  // Hydrate the collapsed flag from localStorage so the user's preference
  // persists across reloads.
  useEffect(() => {
    let collapsedNext = true;
    try {
      collapsedNext = localStorage.getItem(COLLAPSED_FLAG) !== "0";
    } catch {}
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage is browser-only, so this hydration must run post-mount. */
    setCollapsed(collapsedNext);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_FLAG, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.status]);

  if (disabled || !userId) return null;

  const isStreaming = chat.status === "streaming" || chat.status === "submitting";
  const canSend = draft.trim().length > 0 && !isStreaming;

  function handleSend() {
    if (!canSend) return;
    const text = draft;
    setDraft("");
    void chat.send(text);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            key="dock"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              "pointer-events-auto flex h-[480px] w-[360px] max-w-[calc(100vw-2rem)] flex-col border bg-white/85 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl",
              mistRadii.panel,
            )}
            style={{ borderColor: `${mistColors.aiPlum}55` }}
          >
            <DockHeader
              onClose={() => setOpen(false)}
              onClear={chat.clear}
              hasMessages={chat.messages.length > 0}
            />
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              {chat.messages.length === 0 ? (
                <DockEmpty />
              ) : (
                <div className="space-y-3">
                  {chat.messages.map((m) => (
                    <ScoutBubble
                      key={m.id}
                      message={m}
                      onSuggestStep={onSuggestStep}
                    />
                  ))}
                  {isStreaming && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <span
                        className="h-1 w-1 animate-pulse rounded-full"
                        style={{ background: mistColors.aiPlum }}
                      />
                      Scout thinking…
                    </span>
                  )}
                </div>
              )}
              {chat.error && (
                <p className="mt-2 text-[12px] leading-5 text-rose-600">
                  {chat.error}
                </p>
              )}
            </div>
            <DockComposer
              draft={draft}
              onChange={setDraft}
              onSend={handleSend}
              onStop={chat.stop}
              status={chat.status}
              canSend={canSend}
              isStreaming={isStreaming}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!open && !collapsed && (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cx(
            "pointer-events-auto flex items-center gap-2 border bg-white/65 px-3 py-2 backdrop-blur-xl shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition hover:bg-white/85",
            mistRadii.control,
          )}
          style={{ borderColor: `${mistColors.aiPlum}66` }}
        >
          <AgentCharacter id="scout" awake size={28} />
          <span
            className="text-[12px] font-medium tracking-tight"
            style={{ color: mistColors.aiPlum }}
          >
            Ask Scout anything
          </span>
        </motion.button>
      )}

      {!open && collapsed && (
        <motion.button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setOpen(true);
          }}
          aria-label="Open Scout dock"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cx(
            "pointer-events-auto flex h-12 w-12 items-center justify-center border bg-white/65 backdrop-blur-xl shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition hover:bg-white/85",
            mistRadii.control,
          )}
          style={{ borderColor: `${mistColors.aiPlum}66` }}
        >
          <MessageCircle
            className="h-5 w-5"
            style={{ color: mistColors.aiPlum }}
          />
        </motion.button>
      )}
    </div>
  );
}

function DockHeader({
  onClose,
  onClear,
  hasMessages,
}: {
  onClose: () => void;
  onClear: () => void;
  hasMessages: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-white/55 px-3 py-2.5">
      <AgentCharacter id="scout" awake size={28} />
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: mistColors.aiPlum }}
        >
          Scout
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
          AI · optional
        </div>
      </div>
      {hasMessages && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
      <button
        type="button"
        aria-label="Close dock"
        onClick={onClose}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/55 bg-white/55 text-slate-500 transition hover:bg-white/75 hover:text-slate-800"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DockEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <AgentCharacter id="scout" awake size={56} />
      <div className="max-w-[260px]">
        <div className="text-[14px] font-semibold tracking-tight text-slate-900">
          Hi — I&apos;m Scout.
        </div>
        <p className="mt-1 text-[12px] leading-5 text-slate-600">
          Ask me anything about Recruit, or tell me what kind of role you want.
          I&apos;ll save useful answers to your profile.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <span
            key={prompt}
            className={cx(
              "border border-white/55 bg-white/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500",
              mistRadii.control,
            )}
          >
            {prompt}
          </span>
        ))}
      </div>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Pick a headline for me",
  "Best company size?",
  "Should I link DevPost?",
] as const;

function DockComposer({
  draft,
  onChange,
  onSend,
  onStop,
  status,
  canSend,
  isStreaming,
}: {
  draft: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  status: string;
  canSend: boolean;
  isStreaming: boolean;
}) {
  return (
    <div className="border-t border-white/55 px-3 py-2.5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            value={draft}
            placeholder="Type a message…"
            readOnly={false}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
        </div>
        {isStreaming ? (
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            size="sm"
            disabled={!canSend}
            onClick={onSend}
          >
            Send <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        )}
      </div>
      {status === "error" && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-rose-600">
          Send failed — try again
        </p>
      )}
    </div>
  );
}

function ScoutBubble({
  message,
  onSuggestStep,
}: {
  message: ScoutMessage;
  onSuggestStep?: (target: ToolHint["targetStep"]) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cx(
            "max-w-[80%] rounded-[18px] rounded-tr-sm border border-white/55 bg-white/55 px-3 py-2 text-[13px] leading-snug text-slate-800",
          )}
        >
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="shrink-0">
        <AgentCharacter id="scout" awake size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-slate-900">
          {message.text || (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              …
            </span>
          )}
        </div>
        {message.toolHints && message.toolHints.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.toolHints.map((hint, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  hint.targetStep && onSuggestStep?.(hint.targetStep)
                }
                className={cx(
                  "inline-flex items-center gap-1 border border-white/55 bg-white/40 px-2 py-1 text-[11px] text-slate-700 transition hover:bg-white/65",
                  mistRadii.control,
                )}
                style={{ borderColor: `${mistColors.aiPlum}55` }}
              >
                {hint.actionLabel ?? hint.suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
