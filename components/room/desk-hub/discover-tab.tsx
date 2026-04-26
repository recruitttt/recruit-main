"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";

type Props = { userId: string | null };

export function DiscoverTab({ userId }: Props) {
  const seedRecruiters = useAction(convexRefs.recruiterActions.seedRecruiters);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFetch() {
    if (!userId) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await seedRecruiters({ userId });
      setMsg(
        `Seeded ${(out as { seeded: number }).seeded} recruiters from top tailored jobs.`,
      );
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm">Find relevant jobs and assign recruiters.</div>
      <button
        onClick={handleFetch}
        disabled={busy || !userId}
        className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
      >
        {busy ? "Fetching…" : "Fetch Top Jobs"}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
