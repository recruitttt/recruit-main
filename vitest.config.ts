import { defineConfig } from "vitest/config";

// Most suites under tests/ are plain tsx scripts (node:assert, run via the
// test:* npm scripts). Only the files below use the vitest API, so they are
// listed explicitly to keep vitest from loading the script-style suites.
export default defineConfig({
  test: {
    include: [
      "tests/brainstorm-matcher.test.ts",
      "tests/error-messages.test.ts",
      "tests/personalization-extractor.test.ts",
      "tests/personalization-questions.test.ts",
      "tests/provider-detection.test.ts",
      "tests/recruiter-appearance.test.ts",
      "tests/recruiter-extractor.test.ts",
      "tests/recruiter-layout.test.ts",
      "tests/recruiter-prompt.test.ts",
      "tests/room-animation.test.ts",
      "tests/room-spawn.test.ts",
      "lib/intake/linkedin/__tests__/parsers.test.ts",
    ],
  },
});
