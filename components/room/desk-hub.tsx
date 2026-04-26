"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { useRoomStore } from "./room-store";
import { ProfileTab } from "./desk-hub/profile-tab";
import { TopJobsTab } from "./desk-hub/top-jobs-tab";
import { DiscoverTab } from "./desk-hub/discover-tab";
import { ResumesTab } from "./desk-hub/resumes-tab";
import { ApplyQueueTab } from "./desk-hub/apply-queue-tab";

type TabId = "profile" | "discover" | "top-jobs" | "resumes" | "apply-queue";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "discover", label: "Discover" },
  { id: "top-jobs", label: "Top 5" },
  { id: "resumes", label: "Resumes" },
  { id: "apply-queue", label: "Apply Queue" },
];

type Props = { userId: string | null };

export function DeskHub({ userId }: Props) {
  const playerPose = useRoomStore((s) => s.playerPose);
  const [tab, setTab] = useState<TabId>("top-jobs");

  if (playerPose !== "sitting") return null;

  return (
    <Html position={[0, 1.5, -0.3]} transform distanceFactor={1.4} occlude>
      <div className="w-[640px] h-[400px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex-1 px-3 py-2 text-xs font-medium " +
                (tab === t.id
                  ? "bg-white border-b-2 border-blue-500 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {tab === "profile" && <ProfileTab userId={userId} />}
          {tab === "top-jobs" && <TopJobsTab userId={userId} />}
          {tab === "discover" && <DiscoverTab userId={userId} />}
          {tab === "resumes" && <ResumesTab userId={userId} />}
          {tab === "apply-queue" && <ApplyQueueTab userId={userId} />}
        </div>
      </div>
    </Html>
  );
}
