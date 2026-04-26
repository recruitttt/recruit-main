"use client";

//
// IntakeProgressBanner — small, self-contained banner shown above the
// dashboard when any intake adapter (GitHub / LinkedIn / Resume / Web /
// Chat / AI Report) is still `queued` or `running`.
//
// Subscribes to `api.intakeRuns.byUserKind` for each kind. While there is
// at least one in-flight run, render a single-line "still finishing intake"
// strip so users who navigated to /dashboard from /ready before intake
// completed see that work is still happening in the background.
//

import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";

type IntakeKind = "github" | "linkedin" | "resume" | "web" | "chat" | "ai-report";

interface IntakeRunRow {
  status?: "queued" | "running" | "completed" | "failed";
  kind?: IntakeKind;
}

const KIND_LABEL: Record<IntakeKind, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  resume: "Resume",
  web: "Website",
  chat: "Chat",
  "ai-report": "AI report",
};

export function IntakeProgressBanner() {
  const reduceMotion = useReducedMotion();
  const session = authClient.useSession();
  const userId = session.data?.user?.id ?? null;
  const args = userId ? { userId } : "skip";

  const ghRun = useQuery(api.intakeRuns.byUserKind, args === "skip" ? args : { ...args, kind: "github" }) as
    | IntakeRunRow
    | null
    | undefined;
  const liRun = useQuery(api.intakeRuns.byUserKind, args === "skip" ? args : { ...args, kind: "linkedin" }) as
    | IntakeRunRow
    | null
    | undefined;
  const reRun = useQuery(api.intakeRuns.byUserKind, args === "skip" ? args : { ...args, kind: "resume" }) as
    | IntakeRunRow
    | null
    | undefined;
  const webRun = useQuery(api.intakeRuns.byUserKind, args === "skip" ? args : { ...args, kind: "web" }) as
    | IntakeRunRow
    | null
    | undefined;

  const inFlight: string[] = [];
  if (isInFlight(ghRun)) inFlight.push(KIND_LABEL.github);
  if (isInFlight(liRun)) inFlight.push(KIND_LABEL.linkedin);
  if (isInFlight(reRun)) inFlight.push(KIND_LABEL.resume);
  if (isInFlight(webRun)) inFlight.push(KIND_LABEL.web);

  const visible = inFlight.length > 0;

  const summary = visible
    ? inFlight.length === 1
      ? `${inFlight[0]} intake is still pulling`
      : inFlight.length === 2
        ? `${inFlight.join(" and ")} intakes are still pulling`
        : `${inFlight.slice(0, -1).join(", ")}, and ${inFlight[inFlight.length - 1]} intakes are still pulling`
    : "";

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="intake-progress-banner"
          role="status"
          aria-live="polite"
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 rounded-2xl border border-sky-200/60 bg-sky-50/55 px-3 py-2 text-[12px] leading-5 text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
        >
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
          <span className="min-w-0 truncate">
            {summary}. Your dashboard will fill in as each source finishes.
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function isInFlight(row: IntakeRunRow | null | undefined): boolean {
  if (!row) return false;
  return row.status === "queued" || row.status === "running";
}
