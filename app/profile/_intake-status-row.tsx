"use client";

//
// IntakeStatusRow — small one-line row that mirrors the Ready Room status
// pills, smaller and inline. Lives at the top of the data view so users can
// see at a glance whether each source synced and retry the failed ones.
//

import { useCallback, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { cx, mistClasses, mistRadii } from "@/components/design-system";
import { isGithubConnected } from "@/lib/intake/shared/source-state";
import { logProfileEvent } from "@/lib/profile";
import {
  buildSnapshot,
  StatusPill,
  type IntakeKind,
  type IntakeRunRow,
} from "@/components/ready/intake-status";

interface IntakeStatusRowProps {
  userId: string;
}

export function IntakeStatusRow({
  userId,
}: IntakeStatusRowProps): React.ReactElement {
  const githubRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "github",
  }) as IntakeRunRow;
  const linkedinRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "linkedin",
  }) as IntakeRunRow;
  const resumeRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "resume",
  }) as IntakeRunRow;
  const webRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "web",
  }) as IntakeRunRow;
  const chatRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "chat",
  }) as IntakeRunRow;

  const profileRow = useQuery(api.userProfiles.byUser, { userId }) as
    | {
        profile?: {
          links?: Record<string, string | undefined>;
          resume?: { filename?: string };
        };
      }
    | null
    | undefined;

  const accountConnections = useQuery(api.auth.connectedAccounts, {
    userId,
  });

  const profile = profileRow?.profile;
  const githubConnected = isGithubConnected(accountConnections);

  const attempted: Record<IntakeKind, boolean> = useMemo(() => {
    const links = profile?.links ?? {};
    return {
      github: githubConnected || Boolean(links.github),
      linkedin: Boolean(links.linkedin?.trim()),
      resume: Boolean(profile?.resume?.filename?.trim()),
      web: Boolean(links.website?.trim() || links.devpost?.trim()),
      // On /profile we treat chat as attempted only if a run row exists —
      // otherwise it shows as Skipped which is the more honest signal.
      chat: Boolean(chatRun),
    };
  }, [profile, githubConnected, chatRun]);

  const snapshot = useMemo(
    () =>
      buildSnapshot({
        runs: {
          github: githubRun,
          linkedin: linkedinRun,
          resume: resumeRun,
          web: webRun,
          chat: chatRun,
        },
        attempted,
      }),
    [githubRun, linkedinRun, resumeRun, webRun, chatRun, attempted],
  );

  const runGithubIntake = useAction(api.intakeActions.runGithubIntake);
  const runWebIntake = useAction(api.intakeActions.runWebIntake);
  const [retrying, setRetrying] = useState<IntakeKind | null>(null);

  const retry = useCallback(
    async (kind: IntakeKind) => {
      if (retrying) return;
      setRetrying(kind);
      try {
        if (kind === "github" && githubConnected) {
          await runGithubIntake({ userId, force: true });
        } else if (kind === "linkedin") {
          const url = profile?.links?.linkedin?.trim();
          if (url) {
            await fetch("/api/intake/linkedin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ profileUrl: url }),
            });
          }
        } else if (kind === "web") {
          const links = profile?.links ?? {};
          const url = links.website?.trim() || links.devpost?.trim();
          if (url) {
            await runWebIntake({
              userId,
              url,
              kind: links.website ? "website" : "devpost",
            });
          }
        } else {
          logProfileEvent(
            "chat",
            `Retry of ${kind} not supported from /profile`,
            "info",
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logProfileEvent("chat", `Retry of ${kind} failed`, "error", { message });
      } finally {
        setRetrying(null);
      }
    },
    [retrying, githubConnected, profile, runGithubIntake, runWebIntake, userId],
  );

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 border bg-white/30 px-3 py-2",
        mistRadii.nested,
        "border-white/50",
      )}
    >
      <span className={cx(mistClasses.sectionLabel, "shrink-0 text-[10px]")}>
        Sources
      </span>
      {snapshot.map((entry) => {
        const canRetry = entry.status === "failed";
        return (
          <button
            key={entry.kind}
            type="button"
            disabled={!canRetry || retrying === entry.kind}
            onClick={canRetry ? () => void retry(entry.kind) : undefined}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition",
              canRetry
                ? "cursor-pointer hover:bg-white/60"
                : "cursor-default",
            )}
            title={
              canRetry
                ? `Retry ${entry.name} intake`
                : `${entry.name}: ${entry.caption}`
            }
          >
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
              {entry.name}
            </span>
            <StatusPill status={entry.status} size="sm" />
            {canRetry && (
              <RefreshCw
                className={cx(
                  "h-2.5 w-2.5 text-slate-500",
                  retrying === entry.kind && "animate-spin",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
