"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRoomStore } from "../room-store";

type Props = { userId: string | null };

type ApplicationJobRow = {
  _id: string;
  company?: string;
  title?: string;
  status: string;
  provider?: string;
  targetUrl?: string;
};

const STATUS_CLASSES: Record<string, string> = {
  queued: "bg-gray-100 text-gray-700",
  claimed: "bg-blue-100 text-blue-700",
  fill_in_progress: "bg-blue-100 text-blue-700",
  filled_verified: "bg-green-100 text-green-700",
  submit_attempted: "bg-amber-100 text-amber-700",
  submitted_confirmed: "bg-green-100 text-green-700",
  submitted_probable: "bg-green-100 text-green-700",
  waiting_for_user_input: "bg-amber-100 text-amber-700",
};

function statusClass(status: string): string {
  if (STATUS_CLASSES[status]) return STATUS_CLASSES[status];
  if (status.startsWith("failed_")) return "bg-rose-100 text-rose-700";
  return "bg-gray-100 text-gray-700";
}

export function ApplyQueueTab({ userId }: Props) {
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const jobs = useQuery(
    api.applicationJobs.listRecentForCurrentUser,
    userId ? { limit: 25 } : "skip",
  ) as ApplicationJobRow[] | undefined;

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!jobs) return <div className="text-gray-500">Loading…</div>;
  if (jobs.length === 0)
    return (
      <div className="space-y-3">
        <div className="text-gray-500 text-sm">No applications queued.</div>
        <button
          onClick={() => setTerminalActive(true)}
          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded"
        >
          Open Terminal
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <div
          key={j._id}
          className="p-3 border border-gray-200 rounded flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{j.title ?? "(role)"}</div>
            <div className="text-xs text-gray-500 truncate">
              {j.company ?? "(company)"}
              {j.provider ? ` · ${j.provider}` : ""}
            </div>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 mt-1 rounded ${statusClass(j.status)}`}>
              {j.status}
            </span>
          </div>
          <button
            onClick={() => setTerminalActive(true)}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded shrink-0"
          >
            Open Terminal
          </button>
        </div>
      ))}
    </div>
  );
}
