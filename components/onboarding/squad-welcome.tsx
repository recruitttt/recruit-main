"use client";

//
// Squad welcome splash — the 3-second meet-the-cast that runs before the
// 5-step onboarding kicks in. Shows once per browser (intro flag persisted
// to localStorage) and is skipped when the user lands deep in the flow
// (?step=2+) or is already authenticated.
//

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import {
  ActionButton,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";
import { playWake } from "@/lib/sounds";

const ENTER_STAGGER = 0.12;
const SCOUT_WAKE_AT = 1.6; // s
const CAPTION_AT = 2.0; // s
const CTA_AT = 2.6; // s

export function SquadWelcome({ onContinue }: { onContinue: () => void }) {
  const reduce = useReducedMotion();
  const [scoutAwake, setScoutAwake] = useState(false);

  useEffect(() => {
    if (reduce) {
      // Reduced-motion users see the awake state immediately, no SFX.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScoutAwake(true);
      return;
    }
    const wakeTimer = window.setTimeout(() => {
      setScoutAwake(true);
      playWake();
    }, SCOUT_WAKE_AT * 1000);
    return () => window.clearTimeout(wakeTimer);
  }, [reduce]);

  return (
    <div className="relative flex min-h-[480px] flex-1 flex-col items-center justify-center px-5 py-10 text-center md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(63,122,86,0.10), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={cx(
            "flex items-center gap-2 border border-white/55 bg-white/45 px-3 py-1 backdrop-blur-xl",
            mistRadii.control,
          )}
        >
          <span className={cx(mistClasses.sectionLabel, "text-[#3F7A56]")}>
            Meet your squad
          </span>
        </motion.div>

        <div
          className="flex items-end justify-center gap-3 sm:gap-5"
          aria-label="Your squad of five agents"
        >
          {AGENT_ORDER.map((id, i) => {
            const isScout = id === "scout";
            const awake = isScout && scoutAwake;
            return (
              <motion.div
                key={id}
                initial={reduce ? false : { opacity: 0, y: 18, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        delay: i * ENTER_STAGGER,
                        type: "spring",
                        stiffness: 280,
                        damping: 22,
                      }
                }
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={
                    isScout && awake && !reduce
                      ? { scale: [1, 1.18, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AgentCharacter
                    id={id}
                    awake={awake}
                    size={isScout ? 76 : 60}
                  />
                </motion.div>
                <motion.span
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: reduce ? 0 : i * ENTER_STAGGER + 0.3,
                    duration: reduce ? 0 : 0.3,
                  }}
                  className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
                  style={{ color: AGENTS[id].hue }}
                >
                  {AGENTS[id].name}
                </motion.span>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : CAPTION_AT, duration: reduce ? 0 : 0.5 }}
          className="max-w-[520px]"
        >
          <h1 className="font-serif text-[44px] leading-[1.04] tracking-[-0.02em] text-slate-950 sm:text-[52px]">
            Five agents.
            <br />
            One job: get you hired.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-[15px]">
            Each one applies to a different role in parallel. Tell us a little
            about yourself and they get to work.
          </p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  delay: CTA_AT,
                  type: "spring",
                  stiffness: 320,
                  damping: 22,
                }
          }
        >
          <ActionButton variant="primary" size="lg" onClick={onContinue}>
            Let&apos;s start <ArrowRight className="h-4 w-4" />
          </ActionButton>
        </motion.div>

        <motion.button
          type="button"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : CTA_AT + 0.2, duration: reduce ? 0 : 0.4 }}
          onClick={onContinue}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline"
        >
          Skip intro
        </motion.button>
      </div>
    </div>
  );
}
