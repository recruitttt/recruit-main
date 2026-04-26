"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = { userId: string | null };

type TailoredAppRow = {
  _id: string;
  company?: string;
  title?: string;
};

// `tailoredApplications` is not yet a generated Convex module; the field/module may
// not exist on the typed `api` object. We probe it dynamically and degrade
// gracefully so the tab renders even before the backend query lands.
const tailoredApi = (api as unknown as Record<string, Record<string, unknown>>)
  .tailoredApplications;
const listQueryRef =
  (tailoredApi?.listForUser as Parameters<typeof useQuery>[0] | undefined) ??
  (tailoredApi?.byUser as Parameters<typeof useQuery>[0] | undefined) ??
  null;

export function ResumesTab({ userId }: Props) {
  const apps = useQuery(
    // Fallback to a no-op-style ref when the backend query isn't available;
    // we still pass "skip" to ensure no fetch is attempted.
    listQueryRef ?? ((api as unknown as { userProfiles: { byUser: Parameters<typeof useQuery>[0] } }).userProfiles.byUser),
    listQueryRef && userId ? { userId, limit: 10 } : "skip",
  ) as TailoredAppRow[] | undefined;

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!listQueryRef)
    return (
      <div className="text-gray-500 text-sm">
        Tailored resume list not wired yet. Tailor a job from the dashboard to
        populate this view.
      </div>
    );
  if (!apps) return <div className="text-gray-500">Loading…</div>;
  if (apps.length === 0)
    return <div className="text-gray-500">No tailored resumes yet.</div>;

  return (
    <div className="space-y-2">
      {apps.map((a) => (
        <div key={a._id} className="p-2 border border-gray-200 rounded">
          <div className="font-medium text-sm">{a.title ?? "(role)"}</div>
          <div className="text-xs text-gray-500">{a.company ?? "(company)"}</div>
        </div>
      ))}
    </div>
  );
}
