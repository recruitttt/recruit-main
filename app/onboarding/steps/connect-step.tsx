"use client";

import { useState } from "react";
import { Activity, ArrowRight, Sparkles } from "lucide-react";
import {
  ActionButton,
  TextField,
  cx,
} from "@/components/design-system";
import { GithubIcon, LinkedinIcon } from "@/components/ui/brand-icons";
import { SourceTile } from "@/components/onboarding/source-tile";
import { ProgressBadge } from "@/components/onboarding/progress-badge";
import { canStartSourceRun } from "@/lib/intake/shared/source-state";
import type {
  Data,
  DataUpdate,
  IntakeRunRow,
  Step,
} from "@/app/onboarding/_data";

export function ConnectStepCard({
  data,
  linkCount,
  githubConnected,
  githubRun,
  linkedinRun,
  webRun,
  onLinkSocialGithub,
  onRunGithubIntake,
  onLinkedinSubmit,
  onWebSubmit,
  updateData,
  onAdvance,
}: {
  data: Data;
  linkCount: number;
  githubConnected: boolean;
  githubRun: IntakeRunRow;
  linkedinRun: IntakeRunRow;
  webRun: IntakeRunRow;
  onLinkSocialGithub: () => Promise<void>;
  onRunGithubIntake: (force?: boolean) => Promise<void>;
  onLinkedinSubmit: () => Promise<boolean>;
  onWebSubmit: (kind: "devpost" | "website", url: string) => Promise<void>;
  updateData: (updates: DataUpdate) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const [linkedinPending, setLinkedinPending] = useState(false);
  const [devpostPending, setDevpostPending] = useState(false);
  const [websitePending, setWebsitePending] = useState(false);
  const [githubPending, setGithubPending] = useState(false);
  const [linkedinSaved, setLinkedinSaved] = useState(false);

  const handleLinkedin = async () => {
    setLinkedinPending(true);
    try {
      const saved = await onLinkedinSubmit();
      if (saved) setLinkedinSaved(true);
    } finally {
      setLinkedinPending(false);
    }
  };

  const handleGithub = async () => {
    setGithubPending(true);
    try {
      if (githubConnected) {
        await onRunGithubIntake(
          githubRun?.status === "completed" || githubRun?.status === "failed",
        );
      } else {
        await onLinkSocialGithub();
      }
    } finally {
      setGithubPending(false);
    }
  };

  const handleDevpost = async () => {
    setDevpostPending(true);
    try {
      await onWebSubmit("devpost", data.links.devpost);
    } finally {
      setDevpostPending(false);
    }
  };

  const handleWebsite = async () => {
    setWebsitePending(true);
    try {
      await onWebSubmit("website", data.links.website);
    } finally {
      setWebsitePending(false);
    }
  };

  const githubRunActive = githubRun ? !canStartSourceRun(githubRun) : false;
  const githubActionLabel = githubConnected
    ? githubRun?.status === "failed"
      ? "Retry"
      : "Refresh"
    : "Connect";
  const connectedSources = linkCount + (githubConnected ? 1 : 0);
  const linkedinRunActive = linkedinRun ? !canStartSourceRun(linkedinRun) : false;
  const webRunActive = webRun ? !canStartSourceRun(webRun) : false;

  return (
    <div className="mt-2 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SourceTile
          kind="github"
          title="GitHub"
          subtitle="Repos, languages, stars"
          run={githubRun}
          statusOverride={
            githubConnected && !githubRun ? "running" : undefined
          }
        >
          <div className="flex items-center justify-between gap-2">
            {githubRun ? (
              <ProgressBadge kind="github" run={githubRun} compact />
            ) : githubConnected ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-600">
                Connected
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Not linked
              </span>
            )}
            <ActionButton
              variant={githubConnected ? "secondary" : "primary"}
              size="sm"
              loading={githubPending || githubRunActive}
              disabled={githubPending || githubRunActive}
              onClick={handleGithub}
            >
              <GithubIcon className="h-3.5 w-3.5" />
              {githubRunActive ? "Syncing" : githubActionLabel}
            </ActionButton>
          </div>
          {githubRun && !githubConnected && (
            <p className="mt-2 font-mono text-[11px] leading-5 text-amber-600">
              Reconnect to refresh — your token expired.
            </p>
          )}
        </SourceTile>

        <SourceTile
          kind="linkedin"
          title="LinkedIn"
          subtitle="Roles, dates, headline"
          run={linkedinRun}
        >
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                value={data.links.linkedin}
                placeholder="linkedin.com/in/yourhandle"
                readOnly={false}
                icon={<LinkedinIcon className="h-3.5 w-3.5 text-slate-500" />}
                onChange={(e) => {
                  setLinkedinSaved(false);
                  updateData({ links: { linkedin: e.target.value } });
                }}
              />
            </div>
            <ActionButton
              variant="secondary"
              size="sm"
              loading={linkedinPending}
              disabled={!data.links.linkedin.trim() || linkedinPending}
              onClick={handleLinkedin}
            >
              Save
            </ActionButton>
          </div>
          {linkedinSaved && (
            <p className="mt-1 font-mono text-[11px] leading-5 text-emerald-700">
              Saved &mdash; processing in the background.
            </p>
          )}
          {linkedinRunActive && (
            <p className="mt-1 font-mono text-[11px] leading-5 text-slate-500">
              Juno is reading your LinkedIn now.
            </p>
          )}
        </SourceTile>
      </div>

      <SourceTile
        kind="web"
        title="Web presence (optional)"
        subtitle="DevPost + personal site — Bodhi reads them in parallel"
        run={webRun}
      >
        <div className="grid gap-2 md:grid-cols-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                value={data.links.devpost}
                placeholder="devpost.com/yourhandle"
                readOnly={false}
                icon={<Sparkles className="h-3.5 w-3.5 text-slate-500" />}
                onChange={(e) =>
                  updateData({ links: { devpost: e.target.value } })
                }
              />
            </div>
            <ActionButton
              variant="secondary"
              size="sm"
              loading={devpostPending || webRunActive}
              disabled={
                !data.links.devpost.trim() || devpostPending || webRunActive
              }
              onClick={handleDevpost}
            >
              Save
            </ActionButton>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                value={data.links.website}
                placeholder="yoursite.com"
                readOnly={false}
                icon={<Activity className="h-3.5 w-3.5 text-slate-500" />}
                onChange={(e) =>
                  updateData({ links: { website: e.target.value } })
                }
              />
            </div>
            <ActionButton
              variant="secondary"
              size="sm"
              loading={websitePending || webRunActive}
              disabled={
                !data.links.website.trim() || websitePending || webRunActive
              }
              onClick={handleWebsite}
            >
              Save
            </ActionButton>
          </div>
        </div>
      </SourceTile>

      <div className={cx("flex flex-wrap items-center justify-between gap-3 pt-1")}>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
          {connectedSources > 0
            ? `${connectedSources} source${connectedSources === 1 ? "" : "s"} linked`
            : "Skip and link more later from your profile"}
        </p>
        <ActionButton
          variant={connectedSources > 0 ? "primary" : "secondary"}
          onClick={() =>
            onAdvance(
              connectedSources > 0
                ? `${connectedSources} source${connectedSources === 1 ? "" : "s"} connected`
                : "Skipped extra sources",
              "prefs",
            )
          }
        >
          {connectedSources > 0 ? "Continue" : "Skip for now"}
          <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </div>
  );
}
