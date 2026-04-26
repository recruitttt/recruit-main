"use client";

//
// ReadyRoom — client island for /ready. Owns the live intake-run
// subscriptions, derives the snapshot once, and feeds it to BOTH the
// status panel and the bottom CTA so we don't open duplicate Convex
// subscriptions.
//
// Retry behaviour: failed intakes can be re-fired right from the cards.
// GitHub / Web / Chat go through Convex actions; Resume + LinkedIn go
// through their Next.js routes (they pull deps the Convex bundler can't
// ship — see comments in convex/intakeActions.ts).
//

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, useReducedMotion } from "motion/react";

import { api } from "@/convex/_generated/api";
import {
  cx,
  mistClasses,
} from "@/components/design-system";
import { fadeUp, staggerContainer } from "@/lib/motion-presets";
import { authClient } from "@/lib/auth-client";
import { buildOAuthLinkCallbackURL } from "@/lib/auth-flow";
import {
  isGithubConnected,
  shouldAutoStartGithubIntake,
} from "@/lib/intake/shared/source-state";
import { logProfileEvent } from "@/lib/profile";
import {
  buildSnapshot,
  IntakeStatusPanel,
  type IntakeKind,
  type IntakeRunRow,
} from "@/components/ready/intake-status";
import { EnrichmentChat } from "@/components/ready/enrichment-chat";
import { StartSearchCta } from "@/components/ready/start-search-cta";

interface ReadyRoomProps {
  userId: string;
  fallbackName?: string;
}

export function ReadyRoom({
  userId,
  fallbackName,
}: ReadyRoomProps): React.ReactElement {
  const router = useRouter();
  const reduce = useReducedMotion();
  const githubAutoStartRef = useRef<string | null>(null);
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
    | { profile?: { name?: string; links?: Record<string, string | undefined>; resume?: { filename?: string } } }
    | null
    | undefined;

  const accountConnections = useQuery(api.auth.connectedAccounts, {
    userId,
  });
  const githubSnapshot = useQuery(api.githubSnapshots.latest, {
    userId,
  });

  const profile = profileRow?.profile;
  const githubConnected = isGithubConnected(accountConnections);
  const hasImportedGithub = Boolean(githubSnapshot);

  const runGithubIntake = useAction(api.intakeActions.runGithubIntake);
  const runWebIntake = useAction(api.intakeActions.runWebIntake);
  const disconnectSource = useMutation(api.sourceConnections.disconnectSource);
  const [retrying, setRetrying] = useState<IntakeKind | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntakeKind | null>(null);

  useEffect(() => {
    if (
      !shouldAutoStartGithubIntake({
        connected: githubConnected,
        run: githubRun,
        hasImportedGithub,
      })
    ) {
      return;
    }

    const key = `${userId}:github:${hasImportedGithub ? "imported" : "missing"}`;
    if (githubAutoStartRef.current === key) return;
    githubAutoStartRef.current = key;

    void runGithubIntake({ userId }).catch((err) => {
      githubAutoStartRef.current = null;
      logProfileEvent("github", "GitHub intake failed to start", "error", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, [githubConnected, githubRun, hasImportedGithub, runGithubIntake, userId]);

  // Whether the user actually attempted each source. A source they never
  // linked renders as `Skipped` rather than indefinite `Pending`.
  const attempted: Record<IntakeKind, boolean> = useMemo(() => {
    const links = profile?.links ?? {};
    return {
      github: githubConnected || Boolean(links.github) || hasImportedGithub,
      linkedin: Boolean(links.linkedin?.trim()),
      resume: Boolean(profile?.resume?.filename?.trim()),
      web: Boolean(links.website?.trim() || links.devpost?.trim()),
      // The user is sitting in the chat right now — count it as attempted
      // so it shows `Pending` (not `Skipped`) until the first answer lands.
      chat: true,
    };
  }, [profile, githubConnected, hasImportedGithub]);

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

  // ---------------------------------------------------------------------------
  // Retry handlers
  // ---------------------------------------------------------------------------

  const handleRetry = useCallback(
    async (kind: IntakeKind) => {
      if (retrying) return;
      setRetrying(kind);
      try {
        if (kind === "github") {
          if (!githubConnected) {
            logProfileEvent("github", "Cannot retry GitHub — token missing", "warning");
            return;
          }
          await runGithubIntake({ userId, force: true });
        } else if (kind === "web") {
          const links = profile?.links ?? {};
          const url = links.website?.trim() || links.devpost?.trim();
          if (!url) {
            logProfileEvent("website", "Cannot retry web intake — no URL on file", "warning");
            return;
          }
          await runWebIntake({
            userId,
            url,
            kind: links.website ? "website" : "devpost",
          });
        } else if (kind === "linkedin") {
          const url = profile?.links?.linkedin?.trim();
          if (!url) {
            logProfileEvent("linkedin", "Cannot retry LinkedIn — no URL on file", "warning");
            return;
          }
          await fetch("/api/intake/linkedin", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ profileUrl: url }),
          });
        } else if (kind === "resume") {
          // Resume retry needs the original storage id which we don't always
          // have on /ready — surface a hint instead of silently no-oping.
          logProfileEvent("resume", "Resume retry requires re-upload from /profile", "warning");
        } else if (kind === "chat") {
          logProfileEvent("chat", "Retry isn't applicable to chat intake", "info");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logProfileEvent(
          kind === "github" ? "github" : kind === "linkedin" ? "linkedin" : "chat",
          `Retry of ${kind} failed`,
          "error",
          { message },
        );
      } finally {
        setRetrying(null);
      }
    },
    [retrying, githubConnected, profile, runGithubIntake, runWebIntake, userId],
  );

  const handleConfigureSource = useCallback(
    async (kind: IntakeKind) => {
      if (kind === "github") {
        try {
          const result = await authClient.linkSocial({
            provider: "github",
            callbackURL: buildOAuthLinkCallbackURL(
              window.location.origin,
              "/ready"
            ),
            errorCallbackURL: new URL(
              "/ready?github_error=oauth",
              window.location.origin
            ).toString(),
          });
          const data = (
            result as { data?: { url?: string; redirect?: boolean } } | null
          )?.data;
          if (data?.url && typeof window !== "undefined") {
            window.location.href = data.url;
          }
        } catch (err) {
          logProfileEvent("github", "GitHub reconnect failed to start", "error", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      if (kind === "resume") {
        router.push("/onboarding?step=2");
        return;
      }

      if (kind === "linkedin" || kind === "web") {
        router.push("/onboarding?step=3");
      }
    },
    [router],
  );

  const handleDisconnectSource = useCallback(
    async (kind: IntakeKind) => {
      if (kind === "chat" || disconnecting) return;
      const confirmed = window.confirm(
        `Disconnect ${kind}? This removes the saved connection and clears its intake status.`
      );
      if (!confirmed) return;
      setDisconnecting(kind);
      try {
        await disconnectSource({ userId, kind });
        logProfileEvent(
          kind === "github" ? "github" : kind === "linkedin" ? "linkedin" : "chat",
          `Disconnected ${kind}`,
          "success",
        );
      } catch (err) {
        logProfileEvent(
          kind === "github" ? "github" : kind === "linkedin" ? "linkedin" : "chat",
          `Disconnect of ${kind} failed`,
          "error",
          { message: err instanceof Error ? err.message : String(err) },
        );
      } finally {
        setDisconnecting(null);
      }
    },
    [disconnectSource, disconnecting, userId],
  );

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const displayName = profile?.name?.trim() || fallbackName?.trim() || "friend";
  const pendingCount = snapshot.filter(
    (s) => s.status === "running" || s.status === "pending",
  ).length;

  const subline = useMemo(() => {
    const inFlight = snapshot
      .filter((s) => s.status === "running")
      .map((s) => s.name);
    if (inFlight.length === 0 && pendingCount === 0) {
      return "Everything is in. Answer a few quick questions and we're off.";
    }
    if (inFlight.length === 0) {
      return "Sources are queued up. Chat with Scout while they run.";
    }
    return `Still pulling: ${inFlight.join(", ")}. Chat with Scout while they finish.`;
  }, [snapshot, pendingCount]);

  return (
    <div className={cx("min-h-[calc(100vh-92px)] pb-12", mistClasses.page)}>
      <motion.div
        className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 pt-6 md:px-6"
        variants={staggerContainer(reduce ? 0 : 0.06, reduce ? 0 : 0.04)}
        initial="hidden"
        animate="visible"
      >
        <motion.header variants={fadeUp} className="space-y-1.5">
          <div className={cx(mistClasses.sectionLabel, "text-[var(--color-accent)]")}>
            Ready Room
          </div>
          <h1 className="font-serif text-[34px] leading-[1.05] tracking-tight text-slate-950">
            You&apos;re set, {displayName}. We&apos;re getting things ready.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {subline}
          </p>
        </motion.header>

        <motion.section variants={fadeUp}>
          <IntakeStatusPanel
            snapshot={snapshot}
            onRetry={(kind) => void handleRetry(kind)}
            onConfigure={(kind) => void handleConfigureSource(kind)}
            onDisconnect={(kind) => void handleDisconnectSource(kind)}
            disconnecting={disconnecting}
          />
        </motion.section>

        <motion.section variants={fadeUp}>
          <EnrichmentChat userId={userId} />
        </motion.section>

        <motion.section variants={fadeUp}>
          <StartSearchCta snapshot={snapshot} />
        </motion.section>
      </motion.div>
    </div>
  );
}
