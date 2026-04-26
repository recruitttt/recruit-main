"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued…",
  claimed: "Claimed worker…",
  browser_started: "Loading application page…",
  form_discovered: "Reading form fields…",
  answers_resolved: "Compiling answers from your recruiter chat…",
  fill_in_progress: "Filling form…",
  filled_verified: "Reviewing answers…",
  submit_attempted: "Submitting…",
  submitted_confirmed: "Submitted ✓",
  submitted_probable: "Submitted (verifying)…",
};

type Props = { jobId: string };

export function TerminalProgress({ jobId }: Props) {
  // Try to read the job status; if no `getById` query exists, render a neutral progress bar
  const job = useQuery(
    (api as unknown as { applicationJobs?: { getById?: unknown } }).applicationJobs?.getById as never,
    { jobId } as never,
  ) as { status: string } | undefined | null;
  if (!job) return (
    <div className="mt-2 text-xs text-blue-700 flex items-center gap-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      Working…
    </div>
  );
  const label = STATUS_LABELS[job.status] ?? job.status;
  return (
    <div className="mt-2 text-xs text-blue-700 flex items-center gap-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      {label}
    </div>
  );
}
