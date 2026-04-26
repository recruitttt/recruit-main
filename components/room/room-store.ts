"use client";

import { create } from "zustand";
import type { AgentId } from "@/lib/agents";
import { mergeProfile, readProfile, type UserProfile } from "@/lib/profile";

export type CameraMode = "overview" | "focus";

export type IntakePhase =
  | "inactive"
  | "walking-forward"
  | "waving"
  | "questioning"
  | "walking-back";

export type IntakeMessage = {
  role: "assistant" | "user";
  content: string;
};

type RoomState = {
  selectedAgentId: AgentId | null;
  hoveredAgentId: AgentId | null;
  cameraMode: CameraMode;
  intakePhase: IntakePhase;
  intakeMessages: IntakeMessage[];
  intakePending: boolean;
  intakeError: string | null;
  setSelected: (id: AgentId | null) => void;
  setHovered: (id: AgentId | null) => void;
  startIntake: () => void;
  setIntakePhase: (phase: IntakePhase) => void;
  submitIntakeAnswer: (value: string) => Promise<void>;
  skipIntake: () => void;
  finishIntake: () => void;
};

function profileContextSnippet(p: UserProfile) {
  return {
    name: p.name,
    headline: p.headline,
    summary: p.summary,
    location: p.location,
    skills: p.skills.slice(0, 20),
    experience: p.experience.slice(0, 5).map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    education: p.education.slice(0, 3),
    prefs: p.prefs,
    links: p.links,
  };
}

async function fetchNextScoutMessage(history: IntakeMessage[]): Promise<{
  ok: boolean;
  message?: string;
  done?: boolean;
  updates?: Partial<UserProfile> | null;
  reason?: string;
}> {
  try {
    const res = await fetch("/api/intake/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history,
        profileContext: profileContextSnippet(readProfile()),
      }),
    });
    return (await res.json()) as {
      ok: boolean;
      message?: string;
      done?: boolean;
      updates?: Partial<UserProfile> | null;
      reason?: string;
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

const FALLBACK_OPENER =
  "Hey, while the others get moving — what's the job you'd take in a heartbeat?";

export const useRoomStore = create<RoomState>((set, get) => ({
  selectedAgentId: null,
  hoveredAgentId: null,
  cameraMode: "overview",
  intakePhase: "inactive",
  intakeMessages: [],
  intakePending: false,
  intakeError: null,
  setSelected: (id) => {
    if (get().intakePhase !== "inactive") return;
    set({ selectedAgentId: id, cameraMode: id ? "focus" : "overview" });
  },
  setHovered: (id) => set({ hoveredAgentId: id }),
  startIntake: () => {
    if (get().intakePhase !== "inactive") return;
    set({
      intakePhase: "walking-forward",
      intakeMessages: [],
      intakePending: false,
      intakeError: null,
      selectedAgentId: null,
      cameraMode: "overview",
    });
  },
  setIntakePhase: (phase) => {
    set({ intakePhase: phase });
    if (phase === "questioning" && get().intakeMessages.length === 0) {
      void (async () => {
        set({ intakePending: true, intakeError: null });
        const r = await fetchNextScoutMessage([]);
        if (r.ok && r.message) {
          set({ intakeMessages: [{ role: "assistant", content: r.message }], intakePending: false });
        } else {
          set({
            intakeMessages: [{ role: "assistant", content: FALLBACK_OPENER }],
            intakePending: false,
            intakeError: r.reason ?? "no_response",
          });
        }
      })();
    }
  },
  submitIntakeAnswer: async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (get().intakePending) return;

    const userMsg: IntakeMessage = { role: "user", content: trimmed };
    const history = [...get().intakeMessages, userMsg];
    set({ intakeMessages: history, intakePending: true, intakeError: null });

    const r = await fetchNextScoutMessage(history);

    if (!r.ok) {
      set({
        intakePending: false,
        intakeError: r.reason ?? "no_response",
        intakeMessages: [
          ...history,
          { role: "assistant", content: "Sorry, my brain glitched. Try that again?" },
        ],
      });
      return;
    }

    if (r.updates) {
      try { mergeProfile(r.updates, "chat", "Scout intake"); } catch {}
    }

    const assistantMsg: IntakeMessage = { role: "assistant", content: r.message ?? "" };
    const nextMessages = [...history, assistantMsg];

    if (r.done) {
      set({ intakeMessages: nextMessages, intakePending: false, intakePhase: "walking-back" });
      return;
    }

    set({ intakeMessages: nextMessages, intakePending: false });
  },
  skipIntake: () => {
    const phase = get().intakePhase;
    if (phase === "inactive" || phase === "walking-back") return;
    set({ intakePhase: "walking-back", intakePending: false, intakeError: null });
  },
  finishIntake: () => set({ intakePhase: "inactive", intakePending: false }),
}));

export function hasCompletedRoomIntake(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("recruit:intake-done") === "1";
  } catch {
    return false;
  }
}

export function markRoomIntakeDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("recruit:intake-done", "1");
  } catch {}
}
