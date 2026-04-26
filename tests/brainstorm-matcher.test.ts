import { describe, it, expect } from "vitest";
import { findBrainstormedAnswer } from "../lib/form-engine/brainstorm-matcher";

describe("findBrainstormedAnswer", () => {
  it("matches why_this_company on 'Why are you interested in our company'", () => {
    const out = findBrainstormedAnswer("Why are you interested in our company?", [
      { questionType: "why_this_company", answer: "Mission-fit" },
    ]);
    expect(out).toBe("Mission-fit");
  });

  it("returns null when no answers", () => {
    expect(findBrainstormedAnswer("anything", undefined)).toBeNull();
    expect(findBrainstormedAnswer("anything", [])).toBeNull();
  });

  it("matches leadership_example", () => {
    const out = findBrainstormedAnswer("Describe a time you led a team", [
      { questionType: "leadership_example", answer: "Story" },
    ]);
    expect(out).toBe("Story");
  });

  it("returns null when no match", () => {
    const out = findBrainstormedAnswer("favorite color", [
      { questionType: "why_this_company", answer: "x" },
    ]);
    expect(out).toBeNull();
  });
});
