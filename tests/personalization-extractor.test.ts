import { describe, it, expect, vi } from "vitest";
import { extractInsight } from "../lib/personalization/insight-extractor";

function mockClient(content: string): unknown {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      },
    },
  };
}

describe("extractInsight", () => {
  it("extracts career_goals", async () => {
    const c = mockClient(JSON.stringify({ field: "careerGoals", value: "Lead a platform team" })) as never;
    const out = await extractInsight(c, "career_goals", "Where in 3 years?", "Lead a platform team");
    expect(out?.field).toBe("careerGoals");
    expect(out?.value).toBe("Lead a platform team");
  });

  it("extracts story fragment", async () => {
    const c = mockClient(JSON.stringify({ field: "storyFragments", value: { topic: "Migration", story: "I led..." } })) as never;
    const out = await extractInsight(c, "stories", "Tell me about a project", "I led a migration...");
    expect(out?.field).toBe("storyFragments");
    expect((out?.value as { topic: string }).topic).toBe("Migration");
  });

  it("returns null on malformed", async () => {
    const c = mockClient("not json") as never;
    const out = await extractInsight(c, "values", "?", "x");
    expect(out).toBeNull();
  });
});
