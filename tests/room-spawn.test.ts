import { describe, it, expect } from "vitest";
import { BOUNDS, SPAWN_POINT } from "../lib/room/player-position";
import { STATIONS } from "../lib/room/stations";

describe("player spawn", () => {
  it("spawn point lies inside the runtime movement BOUNDS", () => {
    // BOUNDS is the same constraint applied at runtime in player-character.tsx
    // (single source of truth in lib/room/player-position.ts).
    expect(SPAWN_POINT[0]).toBeGreaterThanOrEqual(BOUNDS.minX);
    expect(SPAWN_POINT[0]).toBeLessThanOrEqual(BOUNDS.maxX);
    expect(SPAWN_POINT[2]).toBeGreaterThanOrEqual(BOUNDS.minZ);
    expect(SPAWN_POINT[2]).toBeLessThanOrEqual(BOUNDS.maxZ);
  });

  it("does not overlap with any station within 1m radius", () => {
    for (const station of STATIONS) {
      const dx = SPAWN_POINT[0] - station.pos[0];
      const dz = SPAWN_POINT[2] - station.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeGreaterThan(1);
    }
  });

  it("does not overlap with any furniture within 1m radius", () => {
    // Hard-coded mirror of furniture positions from components/room/room-furniture.tsx.
    // If furniture moves, update both. (TODO: export FURNITURE_LAYOUT from
    // room-furniture.tsx as a single source of truth.)
    const FURNITURE: Array<{ pos: readonly [number, number, number]; label: string }> = [
      { pos: [0, 0, 3.0], label: "sofa" },
      { pos: [0, 0, 4.6], label: "coffee-table" },
      { pos: [-9.9, 2.1, 1.5], label: "wall-tv" },
      { pos: [9.9, 0, 1.8], label: "bookshelf" },
      { pos: [-8.4, 0, 4.4], label: "plant-fern" },
      { pos: [8.6, 0, 4.6], label: "plant-palm" },
      { pos: [2.4, 0, -4.4], label: "plant-succulent" },
      { pos: [-1.7, 0, 4.2], label: "floor-lamp" },
    ];
    for (const f of FURNITURE) {
      const dx = SPAWN_POINT[0] - f.pos[0];
      const dz = SPAWN_POINT[2] - f.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist, `spawn too close to ${f.label}`).toBeGreaterThan(1);
    }
  });
});
