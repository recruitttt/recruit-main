import { describe, it, expect } from "vitest";
import { generateAppearance } from "../lib/recruiter/appearance";

describe("generateAppearance", () => {
  it("is deterministic for the same seed", () => {
    const a = generateAppearance(12345);
    const b = generateAppearance(12345);
    expect(a).toEqual(b);
  });

  it("produces different results for different seeds", () => {
    const a = generateAppearance(1);
    const b = generateAppearance(2);
    expect(a).not.toEqual(b);
  });

  it("produces values within enum bounds", () => {
    for (let s = 0; s < 100; s++) {
      const a = generateAppearance(s);
      expect([0, 1, 2]).toContain(a.bodyVariant);
      expect([0, 1, 2, 3]).toContain(a.hairStyle);
      expect(["none", "glasses", "clipboard", "coffee", "laptop"]).toContain(a.accessory);
    }
  });
});
