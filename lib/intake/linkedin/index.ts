// LinkedIn intake module — public surface.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2
//
// Replaces the previous Python-sidecar entry point. The TS port uses the
// Browserbase Node SDK + Playwright over CDP to run the same scrape (main
// profile + 8 detail subpages) in a single language so it can ship on Vercel.

export * from "./types";
export {
  parseSection,
  parseExperienceSection,
  parseEducationSection,
  parseSkills,
  parseAbout,
  parseTopCard,
  parsePublications,
  parseHonors,
  parseInterests,
  extractPLines,
  truncateAtSectionEnd,
  parseDateRange,
  isDate,
  isNoise,
  isExtras,
  resolveTitle,
  parseCompanySubline,
  sectionEmpty,
  parsedSkillsToNamed,
  parsedInterestsToNamed,
  type ParsedSkill,
  type ParsedInterest,
  type SectionKind,
  type TopCard,
} from "./parsers";
export {
  makeBrowserbaseSession,
  getDebuggerUrl,
  type BrowserbaseSessionHandle,
  type MakeBrowserbaseSessionInput,
} from "./browserbase";
export { authenticate, type AuthInput, type AuthOutcome } from "./auth";
export { scrapeProfile, type ScrapeProfileInput } from "./scrape";
export { linkedinAdapter, type LinkedInIntakeInput } from "./adapter";
