"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { RoomDetailPanel } from "./room-detail-panel";
import { ScoutIntakeInput } from "./scout-intake-input";
import { useRoomStore, hasCompletedRoomIntake, markRoomIntakeDone } from "./room-store";
import type { RoomSceneProps } from "./room-scene";
import type { RoomIntroPhase } from "./room-intro";

const loadRoomScene = () => import("./room-scene");

const RoomScene = dynamic<RoomSceneProps>(loadRoomScene, {
  ssr: false,
  loading: () => (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/45 bg-[#F2EEE5]">
      <div className="absolute inset-0 animate-pulse rounded-[24px] bg-gradient-to-br from-[#FBF9F4] via-[#F2EEE5] to-[#FBF9F4]" />
      <div className="absolute bottom-6 left-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6B7A90]">
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

export function RoomCanvasClient({ introPhase, showDetailPanel = true, onSceneReady }: Props) {
  const startIntake = useRoomStore((s) => s.startIntake);
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const intakeActive = intakePhase !== "inactive";

  useEffect(() => {
    if (introPhase) return;
    if (hasCompletedRoomIntake()) return;
    startIntake();
  }, [introPhase, startIntake]);

  useEffect(() => {
    if (intakePhase === "walking-back") {
      markRoomIntakeDone();
    }
  }, [intakePhase]);

  return (
    <div className="relative h-[78vh] w-full overflow-hidden rounded-[24px] border border-white/50 bg-[#F2EEE5] shadow-[0_30px_80px_-40px_rgba(15,23,42,0.18),0_10px_30px_-20px_rgba(15,23,42,0.10)]">
      <RoomScene introPhase={introPhase} onReady={onSceneReady} />
      <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/20" />
      {showDetailPanel && !intakeActive ? <RoomDetailPanel /> : null}
      {!introPhase ? <ScoutIntakeInput /> : null}
    </div>
  );
}
