"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ActionButton } from "@/components/design-system";
import { ChatCard } from "@/components/onboarding/chat-card";
import { ReviewSummary } from "@/components/onboarding/review-summary";
import type { Data, LaunchStage } from "@/app/onboarding/_data";

export function ActivateStepCard({
  data,
  selectedRoles,
  linkCount,
  onMergeFinalProfile,
  onLaunch,
}: {
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <ChatCard icon={<Check className="h-4 w-4 text-emerald-700" />}>
      <div className="space-y-4">
        <ReviewSummary
          data={data}
          selectedRoles={selectedRoles}
          linkCount={linkCount}
        />
        <div className="flex flex-col gap-3 border-t border-white/45 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-600">
            Confirm this is accurate. Scout will open the Ready Room so you can
            chat while intake finishes.
          </p>
          {hasConvex ? (
            <ConnectedConfirmButton
              onMergeFinalProfile={onMergeFinalProfile}
              onLaunch={onLaunch}
            />
          ) : (
            <ActionButton variant="secondary" size="lg" disabled>
              Convex not configured
            </ActionButton>
          )}
        </div>
      </div>
    </ChatCard>
  );
}

function ConnectedConfirmButton({
  onMergeFinalProfile,
  onLaunch,
}: {
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<LaunchStage>("idle");

  function handleConfirm() {
    try {
      setError("");
      setSaving(true);
      setStage("starting");
      onMergeFinalProfile();
      onLaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
      setSaving(false);
    }
  }

  const buttonLabel =
    stage === "error"
      ? "Retry"
      : saving
        ? "Opening Ready Room"
        : "Confirm and continue";

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
      {stage === "starting" && (
        <div className="w-full rounded-[18px] border border-sky-200/70 bg-sky-50/45 px-3 py-2 text-xs leading-5 text-sky-800 sm:w-72">
          Saving your profile. We&apos;ll wait for your sources in the Ready
          Room.
        </div>
      )}
      <ActionButton
        variant="primary"
        size="lg"
        loading={saving}
        onClick={handleConfirm}
      >
        {buttonLabel} <ArrowRight className="h-4 w-4" />
      </ActionButton>
      {error && (
        <span className="max-w-64 text-right text-xs leading-5 text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
