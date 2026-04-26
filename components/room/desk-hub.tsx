"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { useRoomStore } from "./room-store";
import { ProfileTab } from "./desk-hub/profile-tab";
import { TopJobsTab } from "./desk-hub/top-jobs-tab";

// TODO(Phase C): import these once parallel tasks (B5.4, B6.4, etc.) land them.
// import { DiscoverTab } from "./desk-hub/discover-tab";
// import { ResumesTab } from "./desk-hub/resumes-tab";
// import { ApplyQueueTab } from "./desk-hub/apply-queue-tab";

function FallbackTab({ name }: { name: string }) {
  return <div className="text-gray-500 text-sm">{name} tab coming soon.</div>;
}

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
          {/* TODO(Phase C): replace fallbacks with real tabs when discover/resumes/apply-queue land. */}
          {tab === "discover" && <FallbackTab name="Discover" />}
          {tab === "resumes" && <FallbackTab name="Resumes" />}
          {tab === "apply-queue" && <FallbackTab name="Apply Queue" />}
        </div>
      </div>
    </Html>
  );
}
