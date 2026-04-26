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

import { AlertCircle, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { isGithubConnected } from "@/lib/intake/shared/source-state";

type IntakeKind = "github" | "linkedin" | "resume" | "web" | "chat" | "ai-report";

interface IntakeRunRow {
  status?: "queued" | "running" | "completed" | "failed";
  kind?: IntakeKind;
}

interface ProfileRow {
  profile?: {
    links?: {
      github?: string;
      linkedin?: string;
    };
  };
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
  const accountConnections = useQuery(
    api.auth.connectedAccounts,
    args === "skip" ? args : { userId: args.userId },
  );
  const profileRow = useQuery(
    api.userProfiles.byUser,
    args === "skip" ? args : { userId: args.userId },
  ) as ProfileRow | null | undefined;
  const githubSnapshot = useQuery(
    api.githubSnapshots.latest,
    args === "skip" ? args : { userId: args.userId },
  ) as unknown | null | undefined;

  const inFlight: string[] = [];
  if (isInFlight(ghRun)) inFlight.push(KIND_LABEL.github);
  if (isInFlight(liRun)) inFlight.push(KIND_LABEL.linkedin);
  if (isInFlight(reRun)) inFlight.push(KIND_LABEL.resume);
  if (isInFlight(webRun)) inFlight.push(KIND_LABEL.web);

  const links = profileRow?.profile?.links ?? {};
  const sourceStateLoading = Boolean(userId) &&
    (accountConnections === undefined || profileRow === undefined || githubSnapshot === undefined);
  const hasGithubSignal =
    isGithubConnected(accountConnections) ||
    Boolean(githubSnapshot) ||
    Boolean(links.github?.trim()) ||
    isInFlight(ghRun) ||
    ghRun?.status === "completed";
  const hasLinkedinSignal =
    Boolean(links.linkedin?.trim()) ||
    isInFlight(liRun) ||
    liRun?.status === "completed";

  if (userId && !sourceStateLoading && inFlight.length === 0 && !hasGithubSignal && !hasLinkedinSignal) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--color-warn-border)] bg-[var(--color-warn-soft)] px-3 py-3 text-[12px] leading-5 text-[var(--dashboard-panel-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--color-warn)]" />
          <span className="min-w-0">
            Connect GitHub or LinkedIn before running a search. Recruit needs at least one core profile source for meaningful matches.
          </span>
        </div>
        <a
          href="/onboarding?step=3"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-warn-border)] bg-[var(--dashboard-control-bg)] px-3 text-xs font-semibold text-[var(--dashboard-panel-fg)] transition hover:bg-[var(--dashboard-control-hover)]"
        >
          Connect source
        </a>
      </div>
    );
  }

  if (inFlight.length === 0) return null;

  const summary =
    inFlight.length === 1
      ? `${inFlight[0]} intake is still pulling`
      : inFlight.length === 2
        ? `${inFlight.join(" and ")} intakes are still pulling`
        : `${inFlight.slice(0, -1).join(", ")}, and ${inFlight[inFlight.length - 1]} intakes are still pulling`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-2xl border border-[var(--dashboard-row-highlight-border)] bg-[var(--dashboard-row-highlight)] px-3 py-2 text-[12px] leading-5 text-[var(--dashboard-panel-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-ai)]" />
      <span className="min-w-0 truncate">
        {summary}. Your dashboard will fill in as each source finishes.
      </span>
    </div>
  );
}

function isInFlight(row: IntakeRunRow | null | undefined): boolean {
  if (!row) return false;
  return row.status === "queued" || row.status === "running";
}
