"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "../room-store";

type Props = { userId: string | null };

export function TopJobsTab({ userId }: Props) {
  const recruiters = useQuery(convexRefs.recruiters.listForUser, userId ? { userId } : "skip");
  const setActiveRecruiterId = useRoomStore((s) => (s as { setActiveRecruiterId?: (id: string | null) => void }).setActiveRecruiterId);
  const setPlayerPose = useRoomStore((s) => (s as { setPlayerPose?: (p: string) => void }).setPlayerPose);

  if (!userId) return <div className="text-gray-500">Sign in to see top jobs.</div>;
  if (!recruiters) return <div className="text-gray-500">Loading…</div>;
  if (recruiters.length === 0) return <div className="text-gray-500">No top jobs yet — discover and tailor jobs first.</div>;

  function visit(recruiterId: string) {
    setActiveRecruiterId?.(recruiterId);
    setPlayerPose?.("standing");
  }

  type Recruiter = { _id: string; companyName: string; recruiterName: string };
  const list = recruiters as Recruiter[];

  return (
    <div className="space-y-2">
      {list.map((r: Recruiter, i: number) => (
        <div key={r._id} className="p-3 border border-gray-200 rounded flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{r.companyName}</div>
            <div className="text-xs text-gray-500">Recruiter: {r.recruiterName} · #{i + 1}</div>
          </div>
          <button onClick={() => visit(r._id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
            Visit Recruiter
          </button>
        </div>
      ))}
    </div>
  );
}
