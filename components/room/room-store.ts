"use client";

import { create } from "zustand";
import type { AgentId } from "@/lib/agents";
import { saveIntake } from "@/lib/onboarding-storage";

export type CameraMode = "overview" | "focus";

export type IntakePhase =
  | "inactive"
  | "walking-forward"
  | "waving"
  | "questioning"
  | "walking-back";

export type IntakeStep = 0 | 1 | 2;

export type IntakeAnswers = {
  dreamJob?: string;
  lookingFor?: string;
  comp?: string;
};

const INTAKE_FIELDS: readonly (keyof IntakeAnswers)[] = [
  "dreamJob",
  "lookingFor",
  "comp",
] as const;

type RoomState = {
  selectedAgentId: AgentId | null;
  hoveredAgentId: AgentId | null;
  cameraMode: CameraMode;
  intakePhase: IntakePhase;
  intakeStep: IntakeStep;
  intakeAnswers: IntakeAnswers;
  setSelected: (id: AgentId | null) => void;
  setHovered: (id: AgentId | null) => void;
  startIntake: () => void;
  setIntakePhase: (phase: IntakePhase) => void;
  submitIntakeAnswer: (value: string) => void;
  finishIntake: () => void;
};

export const useRoomStore = create<RoomState>((set, get) => ({
  selectedAgentId: null,
  hoveredAgentId: null,
  cameraMode: "overview",
  intakePhase: "inactive",
  intakeStep: 0,
  intakeAnswers: {},
  setSelected: (id) => {
    if (get().intakePhase !== "inactive") return;
    set({ selectedAgentId: id, cameraMode: id ? "focus" : "overview" });
  },
  setHovered: (id) => set({ hoveredAgentId: id }),
  startIntake: () => {
    if (get().intakePhase !== "inactive") return;
    set({
      intakePhase: "walking-forward",
      intakeStep: 0,
      intakeAnswers: {},
      selectedAgentId: null,
      cameraMode: "overview",
    });
  },
  setIntakePhase: (phase) => set({ intakePhase: phase }),
  submitIntakeAnswer: (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const { intakeStep, intakeAnswers } = get();
    const field = INTAKE_FIELDS[intakeStep];
    const nextAnswers: IntakeAnswers = {
      ...intakeAnswers,
      [field]: trimmed,
    };
    if (intakeStep >= 2) {
      saveIntake({
        dreamJob: nextAnswers.dreamJob ?? "",
        lookingFor: nextAnswers.lookingFor ?? "",
        comp: nextAnswers.comp ?? "",
        completedAt: new Date().toISOString(),
      });
      set({
        intakeAnswers: nextAnswers,
        intakePhase: "walking-back",
      });
      return;
    }
    set({
      intakeAnswers: nextAnswers,
      intakeStep: (intakeStep + 1) as IntakeStep,
    });
  },
  finishIntake: () =>
    set({ intakePhase: "inactive", intakeStep: 0 }),
}));
