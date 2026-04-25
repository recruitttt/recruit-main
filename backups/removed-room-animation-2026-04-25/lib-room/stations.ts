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
  /** World-space anchor of the station (where the furniture sits). */
  pos: readonly [number, number, number];
  /** Default position where the character stands when working. */
  stand: readonly [number, number, number];
  /** Yaw (radians) the character faces when at station. */
  facing: number;
  /** Accent hue tied to the stage (for soft volumetric glow). */
  accent: string;
  /** Radius around `stand` where the character can wander during idle. */
  wanderRadius: number;
};

/**
 * Stations are scattered across the room, not linear. Mix of depths, rotations,
 * and corners so the space reads like an actual open office rather than a
 * conveyor belt.
 */
export const STATIONS: readonly Station[] = [
  {
    id: "jobboard",
    stage: "queued",
    label: "Job board",
    pos: [-7.2, 0, -3.4],
    stand: [-7.2, 0, -2.35],
    facing: Math.PI - 0.12,
    accent: "#94A3B8",
    wanderRadius: 0.22,
  },
  {
    id: "workbench",
    stage: "tailoring",
    label: "Workbench",
    pos: [-3.4, 0, -3.2],
    stand: [-3.4, 0, -2.28],
    facing: Math.PI - 0.08,
    accent: "#D97706",
    wanderRadius: 0.18,
  },
  {
    id: "review",
    stage: "reviewing",
    label: "Review panel",
    pos: [0.8, 0, -3.4],
    stand: [0.8, 0, -2.38],
    facing: Math.PI,
    accent: "#7C3AED",
    wanderRadius: 0.22,
  },
  {
    id: "submit",
    stage: "submitting",
    label: "Submit terminal",
    pos: [5.0, 0, -2.0],
    stand: [5.0, 0, -0.92],
    facing: Math.PI + 0.08,
    accent: "#0891B2",
    wanderRadius: 0.18,
  },
  {
    id: "calendar",
    stage: "submitted",
    label: "Calendar desk",
    pos: [7.0, 0, -3.4],
    stand: [7.0, 0, -2.32],
    facing: Math.PI + 0.12,
    accent: "#059669",
    wanderRadius: 0.22,
  },
] as const;

export function stationForStage(stage: Stage): Station {
  return STATIONS.find((s) => s.stage === stage) ?? STATIONS[0];
}
