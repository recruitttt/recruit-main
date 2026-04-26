"use client";

import { Check } from "lucide-react";
import {
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { ProgressBadge } from "@/components/onboarding/progress-badge";
import type { Data, IntakeKind, IntakeRunRow } from "@/app/onboarding/_data";

export function IntakeSummary({
  data,
  accountEmail,
  selectedRoles,
  linkCount,
  completeCount,
  githubConnected,
  githubRun,
  resumeRun,
  linkedinRun,
  webRun,
}: {
  data: Data;
  accountEmail?: string;
  selectedRoles: string[];
  linkCount: number;
  completeCount: number;
  githubConnected: boolean;
  githubRun: IntakeRunRow;
  resumeRun: IntakeRunRow;
  linkedinRun: IntakeRunRow;
  webRun: IntakeRunRow;
}) {
  const liveRuns: Array<{ kind: IntakeKind; run: NonNullable<IntakeRunRow> }> =
    [];
  if (githubRun) liveRuns.push({ kind: "github", run: githubRun });
  if (resumeRun) liveRuns.push({ kind: "resume", run: resumeRun });
  if (linkedinRun) liveRuns.push({ kind: "linkedin", run: linkedinRun });
  if (webRun) liveRuns.push({ kind: "web", run: webRun });

  const rows = [
    { label: "Account", value: accountEmail || data.email || "Needed" },
    { label: "Resume", value: data.resumeFilename || "Needed" },
    {
      label: "Sources",
      value:
        linkCount + (githubConnected ? 1 : 0) > 0
          ? `${linkCount + (githubConnected ? 1 : 0)} linked`
          : "Optional",
    },
    { label: "Roles", value: selectedRoles.join(", ") || "Needed" },
    {
      label: "Prefs",
      value:
        [data.prefs.location, data.prefs.workAuth].filter(Boolean).join(" · ") ||
        "Optional",
    },
  ];

  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between">
        <span className={mistClasses.sectionLabel}>Intake</span>
        <span className="font-mono text-[11px] text-slate-500">
          {completeCount} saved
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const complete = row.value !== "Optional" && row.value !== "Needed";
          return (
            <div
              key={row.label}
              className={cx(
                "border border-white/55 bg-white/28 px-3 py-2",
                mistRadii.nested,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  {row.label}
                </span>
                {complete && <Check className="h-3.5 w-3.5 text-emerald-700" />}
              </div>
              <div
                className={cx(
                  "mt-1 truncate text-sm",
                  row.value === "Needed" ? "text-sky-700" : "text-slate-700",
                )}
              >
                {row.value}
              </div>
            </div>
          );
        })}
      </div>

      {liveRuns.length > 0 && (
        <div className="mt-5 border-t border-white/45 pt-3">
          <div className={cx("mb-2", mistClasses.sectionLabel)}>
            Background intake
          </div>
          <div className="space-y-1.5">
            {liveRuns.map(({ kind, run }) => (
              <ProgressBadge key={kind} kind={kind} run={run} />
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
