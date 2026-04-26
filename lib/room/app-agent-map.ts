import * as THREE from "three";
import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import { mockApplications, type Application } from "@/lib/mock-data";
import { STATIONS, stationForStage, type Station, type StationId } from "./stations";

export const FRONT_STAGE: readonly [number, number, number] = [0, 0, 0.9];
export const FRONT_STAGE_FACING = Math.PI;

export function frontStagePosition(): THREE.Vector3 {
  const [x, y, z] = FRONT_STAGE;
  return new THREE.Vector3(x, y, z);
}

export function applicationForAgent(agentId: AgentId): Application {
  const i = AGENT_ORDER.indexOf(agentId);
  return mockApplications[i] ?? mockApplications[0];
}

export function stationForAgent(agentId: AgentId): Station {
  const app = applicationForAgent(agentId);
  return stationForStage(app.stage);
}

export function agentHomePosition(agentId: AgentId): THREE.Vector3 {
  const station = stationForAgent(agentId);
  const [sx, sy, sz] = station.stand;
  return new THREE.Vector3(sx, sy, sz);
}

export const agentRoomPositions: Record<AgentId, THREE.Vector3> = {
  scout: agentHomePosition("scout"),
  mimi: agentHomePosition("mimi"),
  pip: agentHomePosition("pip"),
  juno: agentHomePosition("juno"),
  bodhi: agentHomePosition("bodhi"),
};

export function currentAgentPosition(agentId: AgentId): THREE.Vector3 {
  return agentRoomPositions[agentId] ?? agentHomePosition(agentId);
}

// Each agent occupies one station at a time. The mapping mutates over the
// session as the swap scheduler picks two agents and trades their stations
// at jittered intervals. Read non-reactively from useFrame (per-frame poll);
// matches the agentRoomPositions pattern above so we don't trigger React
// re-renders on every shuffle.
const initialAssignment: Record<AgentId, StationId> = {
  scout: "jobboard",
  mimi: "workbench",
  pip: "review",
  juno: "submit",
  bodhi: "calendar",
};

const currentStationByAgent: Record<AgentId, StationId> = { ...initialAssignment };
const stationLocks = new Set<AgentId>();

function stationById(id: StationId): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

export function getStationForAgent(agentId: AgentId): Station {
  return stationById(currentStationByAgent[agentId]);
}

export function lockAgentStation(agentId: AgentId): void {
  stationLocks.add(agentId);
}

export function unlockAgentStation(agentId: AgentId): void {
  stationLocks.delete(agentId);
}

export function swapTwoAgentStations(): { a: AgentId; b: AgentId } | null {
  const pool = AGENT_ORDER.filter((id) => !stationLocks.has(id));
  if (pool.length < 2) return null;
  const i = Math.floor(Math.random() * pool.length);
  let j = Math.floor(Math.random() * (pool.length - 1));
  if (j >= i) j += 1;
  const a = pool[i];
  const b = pool[j];
  const tmp = currentStationByAgent[a];
  currentStationByAgent[a] = currentStationByAgent[b];
  currentStationByAgent[b] = tmp;
  return { a, b };
}

export function stationStandPosition(station: Station): THREE.Vector3 {
  const [sx, sy, sz] = station.stand;
  return new THREE.Vector3(sx, sy, sz);
}

export function pickWanderTarget(
  agentId: AgentId,
  timeBucket: number,
  stationOverride?: Station
): THREE.Vector3 {
  const station = stationOverride ?? stationForAgent(agentId);
  const home = stationStandPosition(station);
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
