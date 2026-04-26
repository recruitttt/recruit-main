import { describe, it, expect } from "vitest";
import { deskPositionForIndex } from "../lib/recruiter/desk-layout";

describe("deskPositionForIndex", () => {
  it("places center desk on -Z axis from origin", () => {
    const d = deskPositionForIndex(2); // 0 deg = center
    expect(d.position[0]).toBeCloseTo(0, 1);
    expect(d.position[2]).toBeLessThan(0);
  });

  it("spaces desks at non-overlapping positions", () => {
    const positions = [0, 1, 2, 3, 4].map(deskPositionForIndex);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].position[0] - positions[j].position[0];
        const dz = positions[i].position[2] - positions[j].position[2];
        expect(Math.hypot(dx, dz)).toBeGreaterThan(1.5);
      }
    }
  });
});
