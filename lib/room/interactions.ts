import type { AgentId } from "@/lib/agents";
import type { StationId } from "@/lib/room/stations";

/**
 * Discriminated union describing the nearest in-room interaction target for the
 * player character. Producers (proximity/raycast helpers) emit one of these
 * variants and consumers (HUDs, prompts, hover effects) react to the kind.
 */
export type RoomNearestTarget =
  | { kind: "agent"; id: AgentId }
  | { kind: "station"; id: StationId }
  | { kind: "recruiter"; id: string };
