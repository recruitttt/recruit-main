import { describe, it, expect } from "vitest";
import { SPAWN_POINT } from "../lib/room/player-position";
import { STATIONS } from "../lib/room/stations";

describe("player spawn", () => {
  it("places player away from desk-collision zone", () => {
    expect(Math.abs(SPAWN_POINT[2])).toBeGreaterThanOrEqual(2);
  });

  it("does not overlap with any station within 1m radius", () => {
    for (const station of STATIONS) {
      const dx = SPAWN_POINT[0] - station.pos[0];
      const dz = SPAWN_POINT[2] - station.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeGreaterThan(1);
    }
  });
});
