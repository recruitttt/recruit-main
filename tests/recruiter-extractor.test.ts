import { describe, it, expect, vi } from "vitest";
import { extractBrainstormedAnswer } from "../lib/recruiter/insight-extractor";

function mockClient(content: string): unknown {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      },
    },
  };
}

describe("extractBrainstormedAnswer", () => {
  it("returns parsed answer when present", async () => {
    const client = mockClient(JSON.stringify({ questionType: "why_this_company", answer: "Because their mission..." })) as never;
    const out = await extractBrainstormedAnswer(client, "Why us?", "Because their mission resonates with my work in fintech.");
    expect(out?.questionType).toBe("why_this_company");
    expect(out?.answer).toContain("mission");
  });

  it("returns null when no question identified", async () => {
    const client = mockClient(JSON.stringify({ questionType: null })) as never;
    const out = await extractBrainstormedAnswer(client, "Hi", "Hello");
    expect(out).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    const client = mockClient("not json") as never;
    const out = await extractBrainstormedAnswer(client, "x", "y");
    expect(out).toBeNull();
  });
});
