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
};

// `applicationJobs.listRecentForCurrentUser` is not yet wired in `convexRefs`
// nor exported from the backend module. We probe `api` dynamically and degrade
// gracefully so the tab renders even before the backend query lands.
const appJobsApi = (api as unknown as Record<string, Record<string, unknown>>)
  .applicationJobs;
const listJobsRef =
  (appJobsApi?.listRecentForCurrentUser as
    | Parameters<typeof useQuery>[0]
    | undefined) ?? null;

export function ApplyQueueTab({ userId }: Props) {
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const jobs = useQuery(
    // Fallback ref when the backend query isn't available; still pass "skip".
    listJobsRef ??
      ((api as unknown as { userProfiles: { byUser: Parameters<typeof useQuery>[0] } }).userProfiles.byUser),
    listJobsRef && userId ? { limit: 10 } : "skip",
  ) as ApplicationJobRow[] | undefined;

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!listJobsRef)
    return (
      <div className="text-gray-500 text-sm">
        Apply queue list not wired yet. Once application jobs are listable per
        user, queued jobs will show up here.
      </div>
    );
  if (!jobs) return <div className="text-gray-500">Loading…</div>;
  if (jobs.length === 0)
    return <div className="text-gray-500">No applications queued.</div>;

  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <div
          key={j._id}
          className="p-3 border border-gray-200 rounded flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-medium">{j.title ?? "(role)"}</div>
            <div className="text-xs text-gray-500">
              {j.company ?? "(company)"} · {j.status}
            </div>
          </div>
          <button
            onClick={() => setTerminalActive(true)}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded"
          >
            Open Terminal
          </button>
        </div>
      ))}
    </div>
  );
}
