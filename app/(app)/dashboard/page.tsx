import { RoomCanvasClient } from "@/components/room/room-canvas-client";

export const metadata = {
  title: "The room · Recruit",
  description: "Watch your 5 agents work in a stylized 3D office.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
            Live · agents working
          </div>
          <h1 className="mt-1 font-serif text-4xl leading-tight text-[var(--color-fg)]">
            The room
          </h1>
        </div>
      </div>

      <RoomCanvasClient />
    </div>
  );
}
