"use client";

//
// StartSearchCta — bottom bar shown on /ready. Handles three flows:
//
//   1. All sources are `complete` (or `skipped` for sources the user didn't
//      link). Pressing the primary CTA fires the launch pipeline and routes
//      to /dashboard.
//
//   2. Some sources are still `running` or `pending`. Pressing the primary
//      CTA opens a confirmation modal listing what's still in flight; the
//      user can wait or proceed anyway.
//
//   3. Some sources `failed`. The CTA still works (start with what we have),
//      but the row above warns the user and offers a retry path through the
//      IntakeStatusPanel cards.
//
// The launch pipeline POST used to live inside the onboarding LaunchAndConfirm
// step. It's been moved here so the pipeline only kicks off once the user
// explicitly hits "Start searching for jobs".
//

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowRight, Loader2, X } from "lucide-react";

import {
  ActionButton,
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { resetDashboardLoadingSeen } from "@/components/dashboard/dashboard-entry-gate";
import { logProfileEvent } from "@/lib/profile";
import {
  failedSources,
  isAllReady,
  pendingSources,
  type SourceStatus,
} from "./intake-status";

interface StartSearchCtaProps {
  snapshot: ReadonlyArray<SourceStatus>;
}

type LaunchStage = "idle" | "starting" | "error";

export function StartSearchCta({
  snapshot,
}: StartSearchCtaProps): React.ReactElement {
  const router = useRouter();
  const [stage, setStage] = useState<LaunchStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userOpenedConfirm, setUserOpenedConfirm] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  const ready = isAllReady(snapshot);
  const pending = pendingSources(snapshot);
  const failed = failedSources(snapshot);

  // Modal stays open only while there's still something pending. If the user
  // opens it and then sources finish on their own, the modal disappears
  // without us having to setState in an effect.
  const confirmOpen = userOpenedConfirm && pending.length > 0;

  // Pass `force: true` only when we're knowingly starting before all intake
  // is done — the launch route returns 409 `intake_in_progress` otherwise.
  // The route now reads the canonical UserProfile from Convex via
  // `assembleForPipeline`, so we no longer send a profile blob in the body.
  async function startLaunch(force = false) {
    setStage("starting");
    setError(null);
    try {
      const response = await fetch("/api/onboarding/launch-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            ok: true;
            runId?: string;
            status?: "started";
            message?: string;
            used?: Record<string, unknown>;
          }
        | { ok: false; reason?: string; running?: string[] }
        | null;

      if (!response.ok || !body?.ok) {
        const reason =
          body && !body.ok
            ? body.reason ?? `launch_${response.status}`
            : `launch_${response.status}`;
        // The route returns 409 `intake_in_progress` when something is still
        // running and `force` was false — surface a friendly hint.
        if (response.status === 409 && reason === "intake_in_progress") {
          throw new Error(
            "Some intake is still running. Wait for it, or press Start again to proceed anyway.",
          );
        }
        throw new Error(reason);
      }

      logProfileEvent("chat", "Job search pipeline launched", "success", {
        used: body.used,
      });
      resetDashboardLoadingSeen();
      router.push("/dashboard/loading");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStage("error");
      logProfileEvent("chat", "Launch pipeline failed", "error", { message });
    }
  }

  function handlePrimaryClick() {
    if (pending.length > 0) {
      setUserOpenedConfirm(true);
      return;
    }
    void startLaunch(false);
  }

  function handleProceedAnyway() {
    setUserOpenedConfirm(false);
    void startLaunch(true);
  }

  const primaryLabel =
    stage === "starting"
      ? "Opening dashboard"
      : stage === "error"
        ? "Retry launch"
        : ready
          ? "Start searching for jobs"
          : "Start searching anyway";

  return (
    <>
      <GlassCard density="spacious">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className={cx(mistClasses.sectionLabel, "text-[var(--color-accent)]")}>
              Ready when you are
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {ready
                ? "Every source is in. The first round of jobs goes out as soon as you hit start."
                : pending.length > 0
                  ? `${pending.length} source${pending.length === 1 ? "" : "s"} still pulling — give them a moment for the richest match.`
                  : "Some sources didn't sync. You can start now and retry later from your profile."}
            </p>
            {failed.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {failed.map((s) => s.name).join(", ")} failed — retry from the cards above.
              </p>
            )}
            {error && (
              <p className="mt-2 max-w-md text-xs leading-5 text-rose-600">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {pending.length > 0 && (
              <ActionButton
                variant="secondary"
                size="lg"
                loading={openingDashboard}
                disabled={stage === "starting"}
                onClick={() => {
                  // Open the dashboard now; intake adapters keep running in
                  // Convex regardless of where the user is in the UI. The
                  // dashboard surfaces a "still finishing intake" banner.
                  logProfileEvent(
                    "chat",
                    "User opened dashboard while intake still running",
                    "info",
                  );
                  setOpeningDashboard(true);
                  resetDashboardLoadingSeen();
                  router.push("/dashboard/loading");
                }}
              >
                Open dashboard
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              size="lg"
              loading={stage === "starting"}
              onClick={handlePrimaryClick}
            >
              {primaryLabel}
              {stage !== "starting" && <ArrowRight className="h-4 w-4" />}
            </ActionButton>
          </div>
        </div>
      </GlassCard>

      <AnimatePresence>
        {confirmOpen && (
          <ConfirmModal
            onClose={() => setUserOpenedConfirm(false)}
            onProceed={() => {
              handleProceedAnyway();
            }}
            pending={pending}
            failed={failed}
            launching={stage === "starting"}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ConfirmModal({
  onClose,
  onProceed,
  pending,
  failed,
  launching,
}: {
  onClose: () => void;
  onProceed: () => void | Promise<void>;
  pending: SourceStatus[];
  failed: SourceStatus[];
  launching: boolean;
}): React.ReactElement {
  const inFlightNames = pending.map((s) => s.name).join(", ");
  const failedNames = failed.map((s) => s.name).join(", ");

  return (
    <motion.div
      key="ready-confirm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ready-confirm-title"
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={cx(
          "relative w-full max-w-md border bg-white/85 p-5 backdrop-blur-2xl",
          mistRadii.panel,
          "border-white/65 shadow-[0_22px_60px_rgba(15,23,42,0.18)]",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/55 bg-white/55 text-slate-500 transition hover:bg-white/75 hover:text-slate-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="mb-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
          <span className={cx(mistClasses.sectionLabel, "text-[var(--color-accent)]")}>
            Heads up
          </span>
        </div>
        <h3
          id="ready-confirm-title"
          className="text-lg font-semibold tracking-tight text-slate-950"
        >
          Some sources are still pulling.
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {inFlightNames ? (
            <>
              Your <strong className="font-semibold">{inFlightNames}</strong>{" "}
              intake is still running. Starting now means the first round of
              jobs may miss anything {pending.length === 1 ? "it" : "they"} would have surfaced.
            </>
          ) : (
            "We'll start the search with what we have."
          )}
        </p>
        {failedNames && (
          <p className="mt-2 text-xs leading-5 text-rose-700">
            {failedNames} also failed earlier — you can retry from the cards above.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <ActionButton
            variant="primary"
            size="md"
            loading={launching}
            onClick={() => void onProceed()}
          >
            Proceed anyway <ArrowRight className="h-4 w-4" />
          </ActionButton>
          <ActionButton variant="secondary" size="md" onClick={onClose}>
            Wait
          </ActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
