import { describe, it, expect } from "vitest";
import { pickNextQuestion, gapsFromPersonalization, QUESTIONS } from "../lib/personalization/questions";

describe("pickNextQuestion", () => {
  it("returns null when all answered", () => {
    expect(pickNextQuestion(QUESTIONS.map(q => q.id), [])).toBeNull();
  });
  it("prioritizes gap categories when available", () => {
    const q = pickNextQuestion([], ["career_goals"]);
    expect(q?.category).toBe("career_goals");
  });
  it("falls back to any unanswered if no gap match", () => {
    const q = pickNextQuestion([], ["nonexistent" as never]);
    expect(q).not.toBeNull();
  });
});

describe("gapsFromPersonalization", () => {
  it("returns all gaps for empty profile", () => {
    expect(gapsFromPersonalization(undefined)).toContain("career_goals");
    expect(gapsFromPersonalization(undefined)).toHaveLength(6);
  });
  it("excludes filled fields", () => {
    const gaps = gapsFromPersonalization({ careerGoals: "x" });
    expect(gaps).not.toContain("career_goals");
  });
});
