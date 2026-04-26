"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAction, useQuery } from "convex/react";
import { Footprints, Maximize2, MessageSquare, Minimize2 } from "lucide-react";
import { FocusPanel } from "./focus-panel";
import { FlatChatOverlay } from "./flat-chat-overlay";
import { RecruiterDialogue } from "./recruiter-dialogue";
import { PersonalizationDialogue } from "./personalization-dialogue";
import { ScoutIntakeInput } from "./scout-intake-input";
import { useRoomStore, hasCompletedRoomIntake, markRoomIntakeDone } from "./room-store";
import type { RoomSceneProps } from "./room-scene";
import type { RoomIntroPhase } from "./room-intro";
import { convexRefs } from "@/lib/convex-refs";

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
  userId?: string | null;
  introPhase?: RoomIntroPhase;
  showDetailPanel?: boolean;
  onSceneReady?: () => void;
};

export function RoomCanvasClient({ userId = null, introPhase, showDetailPanel = true, onSceneReady }: Props) {
  const startIntake = useRoomStore((s) => s.startIntake);
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const intakeActive = intakePhase !== "inactive";
  const playerMode = useRoomStore((s) => s.playerMode);
  const togglePlayerMode = useRoomStore((s) => s.togglePlayerMode);
  const chatMode = useRoomStore((s) => s.chatMode);
  const setChatMode = useRoomStore((s) => s.setChatMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-seed recruiters once if the signed-in user has no active recruiters yet.
  const recruiters = useQuery(convexRefs.recruiters.listForUser, userId ? { userId } : "skip");
  const seedRecruiters = useAction(convexRefs.recruiterActions.seedRecruiters);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!userId) return;
    if (recruiters === undefined) return;
    if (recruiters.length > 0) return;
    if (seeded) return;
    setSeeded(true);
    void seedRecruiters({ userId }).catch(() => setSeeded(false));
  }, [userId, recruiters, seeded, seedRecruiters]);

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
      <RoomScene userId={userId} introPhase={introPhase} onReady={onSceneReady} />
      <div className={`pointer-events-none absolute inset-0 ${isFullscreen ? "" : "rounded-[24px]"} ring-1 ring-inset ring-white/20`} />
      {showDetailPanel && !intakeActive ? <FocusPanel /> : null}
      {!introPhase ? <ScoutIntakeInput /> : null}
      <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
        {intakeActive ? (
          <button
            type="button"
            onClick={() => setChatMode(chatMode === "3d" ? "flat" : "3d")}
            aria-pressed={chatMode === "flat"}
            aria-label={chatMode === "flat" ? "Back to 3D room" : "Open flat chat"}
            title={chatMode === "flat" ? "Back to 3D room" : "Switch to flat chat"}
            className={
              (chatMode === "flat"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-white/55 bg-[#F8FBFF]/82 text-[#101827]") +
              " pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl transition hover:bg-[#F8FBFF]"
            }
          >
            <MessageSquare className="h-4 w-4" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              {chatMode === "flat" ? "3D room" : "flat chat"}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={togglePlayerMode}
          aria-pressed={playerMode === "walking"}
          aria-label={playerMode === "walking" ? "Disable walk mode" : "Enable walk mode"}
          title={playerMode === "walking" ? "Walking · click to disable" : "Walk around (W A S D)"}
          className={
            (playerMode === "walking"
              ? "border-[#F97316]/65 bg-[#FFF6EE] text-[#9A3412]"
              : "border-white/55 bg-[#F8FBFF]/82 text-[#101827]") +
            " pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl transition hover:bg-[#F8FBFF]"
          }
        >
          <Footprints className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
            {playerMode === "walking" ? "walking" : "walk"}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-[#F8FBFF]/82 text-[#101827] shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl transition hover:bg-[#F8FBFF]"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      {playerMode === "walking" ? <WasdHint /> : null}
      <FlatChatOverlay />
      <RecruiterDialogue userId={userId} />
      <PersonalizationDialogue userId={userId} />
    </div>
  );
}

function WasdHint() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 select-none rounded-full border border-white/55 bg-[#F8FBFF]/92 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90] shadow-[0_10px_22px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-md">
      <span className="text-[#101827]">W A S D</span> walk · <span className="text-[#101827]">E</span> talk
    </div>
  );
}
