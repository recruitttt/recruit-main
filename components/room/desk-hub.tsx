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
  if (!userId) return <PreviewDeskHub />;

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

function PreviewDeskHub() {
  return (
    <Html position={[0, 1.5, -0.3]} transform distanceFactor={1.4} occlude>
      <div className="flex h-[400px] w-[640px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
            Local preview
          </div>
          <div className="mt-1 text-sm font-medium text-gray-900">Recruit desk</div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden p-4 text-sm">
          <PreviewCard
            title="Top jobs"
            rows={["OpenAI - Product Engineer", "NVIDIA - AI Inference", "Apple - ML Engineer"]}
          />
          <PreviewCard
            title="Queue"
            rows={["Resume variant ready", "Cover note drafted", "Application terminal idle"]}
          />
          <PreviewCard
            title="Profile"
            rows={["Frontend + agents", "Next.js / TypeScript", "San Francisco + remote"]}
          />
          <PreviewCard
            title="Room"
            rows={["Scout nearby", "Desk panel active", "Room camera live"]}
          />
        </div>
      </div>
    </Html>
  );
}

function PreviewCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="min-h-0 rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row} className="truncate text-xs text-gray-700">
            {row}
          </li>
        ))}
      </ul>
    </section>
  );
}
