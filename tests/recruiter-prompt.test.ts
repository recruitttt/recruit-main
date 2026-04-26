import { describe, it, expect } from "vitest";
import { assembleRecruiterPrompt, truncateWords, summarizeProfile } from "../lib/recruiter/prompt";

describe("assembleRecruiterPrompt", () => {
  it("substitutes company name", () => {
    const out = assembleRecruiterPrompt({
      recruiter: { _id: "r1", userId: "u", jobId: "j", companyName: "Stripe", recruiterName: "Sarah", appearanceSeed: 1, positionIndex: 0, status: "active", createdAt: "", updatedAt: "" },
      userProfileSummary: "Engineer with 5y",
      tailoredResumeSummary: "Tailored: ...",
      personalizationSummary: "Values autonomy",
      conversationHistory: [],
    });
    expect(out).toContain("recruiter for Stripe");
    expect(out).toContain("Engineer with 5y");
    expect(out).toContain("Values autonomy");
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("falls back when companyContext missing", () => {
    const out = assembleRecruiterPrompt({
      recruiter: { _id: "r1", userId: "u", jobId: "j", companyName: "Acme", recruiterName: "Pat", appearanceSeed: 1, positionIndex: 0, status: "active", createdAt: "", updatedAt: "" },
      userProfileSummary: "x",
      tailoredResumeSummary: "y",
      personalizationSummary: "",
      conversationHistory: [],
    });
    expect(out).toContain("no cached context");
  });
});

describe("truncateWords", () => {
  it("truncates over the limit", () => {
    expect(truncateWords("a b c d e", 3)).toBe("a b c…");
  });
  it("keeps short strings", () => {
    expect(truncateWords("a b", 5)).toBe("a b");
  });
});

describe("summarizeProfile", () => {
  it("includes experience and skills", () => {
    const out = summarizeProfile({ skills: ["TS", "React"], experience: [{ company: "X", title: "Eng" }], summary: "Good engineer" });
    expect(out).toContain("Good engineer");
    expect(out).toContain("Eng at X");
    expect(out).toContain("TS, React");
  });
});
