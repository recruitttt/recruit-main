import { describe, it, expect } from "vitest";
import { detectProvider, fillModeForProvider } from "../lib/application/provider-detection";

describe("detectProvider", () => {
  it("detects ashby", () => {
    expect(detectProvider("https://jobs.ashbyhq.com/co/abc")).toBe("ashby");
  });
  it("detects lever", () => {
    expect(detectProvider("https://jobs.lever.co/foo/bar")).toBe("lever");
  });
  it("detects greenhouse", () => {
    expect(detectProvider("https://boards.greenhouse.io/co/jobs/123")).toBe("greenhouse");
  });
  it("detects workday", () => {
    expect(detectProvider("https://co.wd1.myworkdayjobs.com/x/job/y")).toBe("workday");
  });
  it("returns unknown for non-matching", () => {
    expect(detectProvider("https://example.com")).toBe("unknown");
  });
  it("returns unknown for malformed", () => {
    expect(detectProvider("not a url")).toBe("unknown");
  });
});

describe("fillModeForProvider", () => {
  it.each([
    ["ashby", "auto"],
    ["lever", "auto"],
    ["greenhouse", "guided"],
    ["workday", "guided"],
    ["unknown", "unsupported"],
  ] as const)("%s -> %s", (p, expected) => {
    expect(fillModeForProvider(p)).toBe(expected);
  });
});
