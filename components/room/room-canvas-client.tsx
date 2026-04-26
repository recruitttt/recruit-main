"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "relative h-screen w-screen overflow-hidden bg-[#F2EEE5]"
          : "relative h-[calc(100vh-180px)] min-h-[520px] w-full overflow-hidden rounded-[24px] border border-white/50 bg-[#F2EEE5] shadow-[0_30px_80px_-40px_rgba(15,23,42,0.18),0_10px_30px_-20px_rgba(15,23,42,0.10)]"
      }
    >
      <RoomScene introPhase={introPhase} onReady={onSceneReady} />
      <div className={`pointer-events-none absolute inset-0 ${isFullscreen ? "" : "rounded-[24px]"} ring-1 ring-inset ring-white/20`} />
      {showDetailPanel && !intakeActive ? <RoomDetailPanel /> : null}
      {!introPhase ? <ScoutIntakeInput /> : null}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="pointer-events-auto absolute right-4 top-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-[#F8FBFF]/82 text-[#101827] shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl transition hover:bg-[#F8FBFF]"
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
