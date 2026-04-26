"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Eye, Lock, ShieldCheck } from "lucide-react";
import { cx, mistRadii } from "@/components/design-system";

const TRUST_ITEMS = [
  {
    icon: Eye,
    label: "Read-only access",
    detail: "We never post or message anyone as you.",
  },
  {
    icon: Lock,
    label: "Encrypted at rest",
    detail: "AES-256-GCM. Your tokens never leave our backend in plaintext.",
  },
  {
    icon: ShieldCheck,
    label: "You approve every job",
    detail: "We never apply to a role without your explicit go-ahead.",
  },
] as const;

const DONT_LIST = [
  "Don't post to your social accounts",
  "Don't email recruiters as you",
  "Don't sell your data",
  "Don't apply to jobs you haven't approved",
] as const;

export function TrustRow() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {TRUST_ITEMS.map(({ icon: Icon, label, detail }) => (
          <span
            key={label}
            title={detail}
            className={cx(
              "inline-flex items-center gap-1.5 border border-white/55 bg-white/35 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-xl",
              mistRadii.control,
            )}
          >
            <Icon className="h-3 w-3 text-[#3F7A56]" strokeWidth={2.2} />
            {label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cx(
            "inline-flex items-center gap-1 border border-white/55 bg-white/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 transition hover:bg-white/55 hover:text-slate-700",
            mistRadii.control,
          )}
        >
          What we don&apos;t do
          <ChevronDown
            className={cx(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              "space-y-1 overflow-hidden border border-white/55 bg-white/30 px-3 py-2 text-[12px] leading-5 text-slate-600 backdrop-blur-xl",
              mistRadii.nested,
            )}
          >
            {DONT_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-1 w-1 rounded-full bg-[#3F7A56]"
                />
                {item}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
