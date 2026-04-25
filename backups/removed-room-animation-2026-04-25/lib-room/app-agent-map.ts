import * as THREE from "three";
import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import { mockApplications, type Application } from "@/lib/mock-data";
import { stationForStage, type Station } from "./stations";

/**
 * Where Scout stands when delivering the intake interlude. Picked to be
 * centered and forward of the agent stations but behind the living-room
 * sofa, so she has clear floor space in front of the camera.
 */
export const FRONT_STAGE: readonly [number, number, number] = [0, 0, 0.9];
export const FRONT_STAGE_FACING = Math.PI;

export function frontStagePosition(): THREE.Vector3 {
  const [x, y, z] = FRONT_STAGE;
  return new THREE.Vector3(x, y, z);
}

/**
 * Implicit mapping: AGENT_ORDER[i] works on mockApplications[i].
 */
export function applicationForAgent(agentId: AgentId): Application {
  const i = AGENT_ORDER.indexOf(agentId);
  return mockApplications[i] ?? mockApplications[0];
}

export function stationForAgent(agentId: AgentId): Station {
  const app = applicationForAgent(agentId);
  return stationForStage(app.stage);
}

/**
 * Character's home position at their station. No jitter — each agent stands
 * exactly at its station's stand point so the character reads as "at" the desk.
 */
export function agentHomePosition(agentId: AgentId): THREE.Vector3 {
  const station = stationForAgent(agentId);
  const [sx, sy, sz] = station.stand;
  return new THREE.Vector3(sx, sy, sz);
}

/**
 * Pick a wander target within the station's radius. Seeded per-agent+time-bucket
 * so it feels organic but deterministic across renders within the same interval.
 */
export function pickWanderTarget(
  agentId: AgentId,
  timeBucket: number
): THREE.Vector3 {
  const station = stationForAgent(agentId);
  const home = agentHomePosition(agentId);
  const seed = hashStringNum(agentId + "_" + timeBucket);
  const angle = seed * Math.PI * 2;
  const r = (0.35 + (seed * 1.618) % 1 * 0.6) * station.wanderRadius;
  return new THREE.Vector3(home.x + Math.cos(angle) * r, 0, home.z + Math.sin(angle) * r);
}

function hashStringNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
