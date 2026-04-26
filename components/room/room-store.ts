"use client";

import { create } from "zustand";
import type { AgentId } from "@/lib/agents";
import type { StationId } from "@/lib/room/stations";

export type CameraMode = "overview" | "focus";

export type FurnitureId =
  | "sofa"
  | "coffee-table"
  | "tv"
  | "bookshelf"
  | "window"
  | "plant"
  | "ceiling-fan";

export type FocusTarget =
  | { kind: "agent"; id: AgentId }
  | { kind: "station"; id: StationId }
  | { kind: "furniture"; id: FurnitureId };

export type PlayerMode = "off" | "walking";

type RoomState = {
  selectedAgentId: AgentId | null;
  hoveredAgentId: AgentId | null;
  hoveredObjectKey: string | null;
  cameraMode: CameraMode;
  focusTarget: FocusTarget | null;
  playerMode: PlayerMode;
  playerNearestAgentId: AgentId | null;
  setSelected: (id: AgentId | null) => void;
  setHovered: (id: AgentId | null) => void;
  setHoveredObject: (key: string | null) => void;
  setFocusTarget: (target: FocusTarget | null) => void;
  clearFocus: () => void;
  setPlayerMode: (mode: PlayerMode) => void;
  togglePlayerMode: () => void;
  setPlayerNearestAgent: (id: AgentId | null) => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  selectedAgentId: null,
  hoveredAgentId: null,
  hoveredObjectKey: null,
  cameraMode: "overview",
  focusTarget: null,
  playerMode: "off",
  playerNearestAgentId: null,
  setSelected: (id) =>
    set({
      selectedAgentId: id,
      cameraMode: id ? "focus" : "overview",
      focusTarget: id ? { kind: "agent", id } : null,
    }),
  setHovered: (id) => set({ hoveredAgentId: id }),
  setHoveredObject: (key) => set({ hoveredObjectKey: key }),
  setFocusTarget: (target) =>
    set({
      focusTarget: target,
      cameraMode: target ? "focus" : "overview",
      selectedAgentId: target?.kind === "agent" ? target.id : null,
    }),
  clearFocus: () =>
    set({
      focusTarget: null,
      cameraMode: "overview",
      selectedAgentId: null,
    }),
  setPlayerMode: (mode) => set({ playerMode: mode }),
  togglePlayerMode: () =>
    set((s) => ({ playerMode: s.playerMode === "walking" ? "off" : "walking" })),
  setPlayerNearestAgent: (id) => set({ playerNearestAgentId: id }),
}));
