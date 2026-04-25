"use client";

import { create } from "zustand";
import type { AgentId } from "@/lib/agents";

export type CameraMode = "overview" | "focus";

type RoomState = {
  selectedAgentId: AgentId | null;
  hoveredAgentId: AgentId | null;
  cameraMode: CameraMode;
  setSelected: (id: AgentId | null) => void;
  setHovered: (id: AgentId | null) => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  selectedAgentId: null,
  hoveredAgentId: null,
  cameraMode: "overview",
  setSelected: (id) =>
    set({ selectedAgentId: id, cameraMode: id ? "focus" : "overview" }),
  setHovered: (id) => set({ hoveredAgentId: id }),
}));
