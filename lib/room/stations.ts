import type { Stage } from "@/lib/mock-data";

export type StationId =
  | "jobboard"
  | "workbench"
  | "review"
  | "submit"
  | "calendar";

export type Station = {
  id: StationId;
  stage: Stage;
  label: string;
  pos: readonly [number, number, number];
  stand: readonly [number, number, number];
  rotation: number;
  facing: number;
  accent: string;
  wanderRadius: number;
};

export const STATIONS: readonly Station[] = [
  {
    id: "jobboard",
    stage: "queued",
    label: "Job board",
    pos: [-8.05, 0, -0.9],
    stand: [-6.85, 0, -0.9],
    rotation: Math.PI / 2,
    facing: -Math.PI / 2,
    accent: "#94A3B8",
    wanderRadius: 0.18,
  },
  {
    id: "workbench",
    stage: "tailoring",
    label: "Workbench",
    pos: [-4.75, 0, -3.5],
    stand: [-4.75, 0, -2.45],
    rotation: 0,
    facing: Math.PI,
    accent: "#D97706",
    wanderRadius: 0.18,
  },
  {
    id: "review",
    stage: "reviewing",
    label: "Review panel",
    pos: [0.85, 0, -3.6],
    stand: [0.85, 0, -2.55],
    rotation: 0,
    facing: Math.PI,
    accent: "#7C3AED",
    wanderRadius: 0.2,
  },
  {
    id: "submit",
    stage: "submitting",
    label: "Submit terminal",
    pos: [6.35, 0, -0.55],
    stand: [5.17, 0, -0.55],
    rotation: -Math.PI / 2,
    facing: Math.PI / 2,
    accent: "#0891B2",
    wanderRadius: 0.18,
  },
  {
    id: "calendar",
    stage: "submitted",
    label: "Calendar desk",
    pos: [6.2, 0, 2.1],
    stand: [5.02, 0, 2.1],
    rotation: -Math.PI / 2,
    facing: Math.PI / 2,
    accent: "#059669",
    wanderRadius: 0.2,
  },
] as const;

export function stationForStage(stage: Stage): Station {
  return STATIONS.find((s) => s.stage === stage) ?? STATIONS[0];
}
