"use client";

import dynamic from "next/dynamic";
import { RoomDetailPanel } from "./room-detail-panel";
import type { RoomSceneProps } from "./room-scene";
import type { RoomIntroPhase } from "./room-intro";

const loadRoomScene = () => import("./room-scene");

const RoomScene = dynamic<RoomSceneProps>(loadRoomScene, {
  ssr: false,
  loading: () => (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--color-surface-1)] via-[var(--color-surface-2)] to-[var(--color-surface-1)]" />
      <div className="absolute bottom-6 left-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        Booting room · agents warming up
      </div>
    </div>
  ),
});

export function preloadRoomScene() {
  void loadRoomScene();
}

type Props = {
  introPhase?: RoomIntroPhase;
  showDetailPanel?: boolean;
  onSceneReady?: () => void;
};

export function RoomCanvasClient({
  introPhase,
  showDetailPanel = true,
  onSceneReady,
}: Props) {
  return (
    <div className="relative h-[78vh] w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[0_30px_80px_-40px_rgba(15,15,18,0.25),0_10px_30px_-20px_rgba(15,15,18,0.15)]">
      <RoomScene introPhase={introPhase} onReady={onSceneReady} />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[rgba(15,15,18,0.04)]" />
      {showDetailPanel ? <RoomDetailPanel /> : null}
    </div>
  );
}
