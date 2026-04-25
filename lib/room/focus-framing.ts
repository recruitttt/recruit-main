import { STATIONS } from "./stations";
import { agentHomePosition } from "./app-agent-map";
import type { AgentId } from "@/lib/agents";
import type { StationId } from "./stations";
import type { FocusTarget, FurnitureId } from "@/components/room/room-store";

export type Framing = {
  cam: readonly [number, number, number];
  look: readonly [number, number, number];
};

const FURNITURE_FRAMES: Record<FurnitureId, Framing> = {
  sofa: { cam: [0, 3.4, 6.2], look: [0, 1.0, 1.4] },
  "coffee-table": { cam: [0, 3.0, 5.8], look: [0, 0.5, 0.8] },
  tv: { cam: [-3.2, 3.4, 4.2], look: [-3.2, 1.4, -2.6] },
  bookshelf: { cam: [3.6, 3.2, 4.4], look: [3.6, 1.6, -2.6] },
  window: { cam: [0, 4.0, 4.6], look: [0, 2.6, -3.2] },
  plant: { cam: [-5.4, 2.6, 3.2], look: [-5.4, 1.0, -1.6] },
  "ceiling-fan": { cam: [0, 4.6, 5.2], look: [0, 3.6, -1.0] },
};

function frameAgent(id: AgentId): Framing {
  const t = agentHomePosition(id);
  return {
    cam: [t.x - 2.8, 2.9, t.z + 5.6],
    look: [t.x + 1.6, 0.9, t.z + 0.3],
  };
}

function frameStation(id: StationId): Framing {
  const station = STATIONS.find((s) => s.id === id) ?? STATIONS[0];
  const [x, , z] = station.pos;
  return {
    cam: [x - 1.4, 3.1, z + 5.2],
    look: [x + 0.4, 1.4, z + 0.2],
  };
}

export function focusFraming(target: FocusTarget): Framing {
  switch (target.kind) {
    case "agent":
      return frameAgent(target.id);
    case "station":
      return frameStation(target.id);
    case "furniture":
      return FURNITURE_FRAMES[target.id];
  }
}
