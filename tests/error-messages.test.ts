import { describe, it, expect } from "vitest";
import { friendlyError } from "../lib/application/error-messages";

describe("friendlyError", () => {
  it("returns specific message for known category", () => {
    const m = friendlyError("failed_unsupported_widget");
    expect(m.title).toContain("Auto-fill");
    expect(m.action.length).toBeGreaterThan(0);
  });
  it("returns generic fallback for unknown", () => {
    const m = friendlyError("not_a_real_category");
    expect(m.title).toContain("wrong");
  });
});
