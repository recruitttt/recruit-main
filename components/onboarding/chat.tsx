"use client";

import { motion } from "motion/react";
import { AGENTS, type AgentId } from "@/lib/agents";
import { AgentCharacter } from "@/components/onboarding/characters";
import { cn } from "@/lib/utils";

function Avatar({ from, size = 32 }: { from: AgentId; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <AgentCharacter id={from} awake size={size + 6} />
    </div>
  );
}

export function AgentMessage({
  from,
  children,
  showAvatar = true,
}: {
  from: AgentId;
  children: React.ReactNode;
  showAvatar?: boolean;
}) {
  const a = AGENTS[from];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <div className="w-8 shrink-0 flex justify-center">
        {showAvatar && <Avatar from={from} />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {showAvatar && (
          <div className="mb-1 flex items-baseline gap-2">
            <span
              className="text-[13px] font-medium tracking-tight"
              style={{ color: a.hue }}
            >
              {a.name}
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--color-fg-subtle)]">
              {a.label}
            </span>
          </div>
        )}
        <div className="text-[15px] leading-relaxed text-[var(--color-fg)]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl rounded-tr-md border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--color-fg)]">
        {children}
      </div>
    </motion.div>
  );
}

export function TypingIndicator({ from }: { from: AgentId }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3"
    >
      <div className="w-8 shrink-0 flex justify-center">
        <Avatar from={from} />
      </div>
      <div className="flex h-8 items-center gap-1 rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border)] px-3 mt-1">
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-fg-subtle)]"
      )}
      style={{
        animation: `pulse-soft 1.2s ease-in-out ${delay}ms infinite`,
      }}
    />
  );
}
