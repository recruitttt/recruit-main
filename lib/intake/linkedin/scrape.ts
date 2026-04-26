// LinkedIn profile scraper — Playwright-driven.
//
// `scrapeProfile(page, profileUrl)` navigates the main profile + 8 detail
// subpages, grabs `await page.content()` for each, runs the SDUI regex
// parsers from `parsers.ts`, and returns a snapshot matching `LinkedInSnapshot`.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2.

import type { Page } from "playwright-core";
import {
  parseAbout,
  parseEducationSection,
  parseExperienceSection,
  parseHonors,
  parseInterests,
  parsePublications,
  parseSkills,
  parseTopCard,
  parsedInterestsToNamed,
  parsedSkillsToNamed,
} from "./parsers";
import {
  type LinkedInExperience,
  type LinkedInSnapshot,
  LinkedInSnapshotSchema,
} from "./types";

const NAV_TIMEOUT_MS = 25_000;
const HYDRATION_TIMEOUT_MS = 20_000;
const HYDRATION_MIN_BYTES = 2_000;
const POST_HYDRATION_DELAY_MS = 2_000;

export interface ScrapeProfileInput {
  /** A Playwright page already attached to a Browserbase context with a valid session. */
  page: Page;
  /** Full LinkedIn profile URL (https://www.linkedin.com/in/<handle>). */
  profileUrl: string;
  /** Optional progress hook — fires for every subpage navigation. */
  onProgress?: (event: { stage: "scrape"; message: string }) => void;
}

/**
 * Scrape a profile + all 8 detail subpages and return a `LinkedInSnapshot`.
 *
 * The shape is validated through the existing Zod schema in `types.ts` to keep
 * downstream consumers (mapper + Convex `linkedinSnapshots.save`) unchanged.
 */
export async function scrapeProfile(
  input: ScrapeProfileInput
): Promise<LinkedInSnapshot> {
  const { page, onProgress } = input;
  const profileUrl = normalizeProfileUrl(input.profileUrl);
  const emit = onProgress ?? (() => undefined);

  // ---- 1. Main profile -----------------------------------------------------
  emit({ stage: "scrape", message: `Loading main profile ${profileUrl}` });
  await safeGoto(page, profileUrl);
  await waitForMain(page);
  const mainHtml = await page.content();
  const pageTitle = await page.title().catch(() => "");
  const topCard = parseTopCard(mainHtml, pageTitle);
  const about = parseAbout(mainHtml);

  // ---- 2. Experience subpage ----------------------------------------------
  const experiences = await scrapeDetail(page, profileUrl, "experience", emit, (html) =>
    parseExperienceSection(html)
  );
  let mergedExperiences = experiences;
  if (mergedExperiences.length === 0) {
    const fallback = experienceFromTopCard(topCard);
    if (fallback) mergedExperiences = [fallback];
  }
  emit({ stage: "scrape", message: `Experience: ${mergedExperiences.length} entries` });

  // ---- 3. Education subpage -----------------------------------------------
  const educations = await scrapeDetail(page, profileUrl, "education", emit, (html) =>
    parseEducationSection(html)
  );
  let mergedEducations = educations;
  if (mergedEducations.length === 0) {
    const fallback = educationFromTopCard(topCard);
    if (fallback) mergedEducations = [fallback];
  }
  emit({ stage: "scrape", message: `Education: ${mergedEducations.length} entries` });

  // ---- 4. Detail subpages with SDUI parsers -------------------------------
  emit({ stage: "scrape", message: "Loading additional LinkedIn detail sections" });

  const skills = await scrapeDetail(page, profileUrl, "skills", emit, (html) =>
    parsedSkillsToNamed(parseSkills(html))
  );
  const certifications = await scrapeDetail(page, profileUrl, "certifications", emit, () => []);
  const projects = await scrapeDetail(page, profileUrl, "projects", emit, () => []);
  const publications = await scrapeDetail(page, profileUrl, "publications", emit, (html) =>
    parsePublications(html)
  );
  const honors = await scrapeDetail(page, profileUrl, "honors", emit, (html) =>
    parseHonors(html)
  );
  const languages = await scrapeDetail(page, profileUrl, "languages", emit, () => []);
  const interests = await scrapeDetail(page, profileUrl, "interests", emit, (html) =>
    parsedInterestsToNamed(parseInterests(html))
  );

  emit({
    stage: "scrape",
    message: `Additional: skills=${skills.length}, certifications=${certifications.length}, projects=${projects.length}, publications=${publications.length}, honors=${honors.length}, languages=${languages.length}, interests=${interests.length}`,
  });

  const company =
    mergedExperiences[0]?.company ?? topCard.company ?? null;

  const raw: unknown = {
    fetchedAt: new Date().toISOString(),
    profileUrl,
    name: topCard.name ?? null,
    about,
    location: topCard.location ?? null,
    openToWork: Boolean(topCard.openToWork),
    jobTitle: topCard.headline ?? null,
    company,
    experiences: mergedExperiences,
    educations: mergedEducations,
    skills,
    certifications,
    projects,
    publications,
    honors,
    languages,
    interests,
    accomplishments: [],
    contacts: [],
  };

  // Validate through the existing schema so downstream code can rely on it.
  return LinkedInSnapshotSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Subpage navigation helpers.
// ---------------------------------------------------------------------------

type DetailSlug =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "publications"
  | "honors"
  | "languages"
  | "interests";

async function scrapeDetail<T>(
  page: Page,
  profileUrl: string,
  slug: DetailSlug,
  emit: (event: { stage: "scrape"; message: string }) => void,
  parse: (html: string) => T[]
): Promise<T[]> {
  const url = `${profileUrl.replace(/\/$/, "")}/details/${slug}/`;
  emit({ stage: "scrape", message: `Loading ${url}` });
  await safeGoto(page, url);
  await waitForMain(page);
  const currentUrl = page.url();
  if (!currentUrl.includes(`/details/${slug}/`)) {
    // LinkedIn either redirected away (login wall) or never resolved.
    return [];
  }
  await scrollPage(page);
  await page.waitForTimeout(800);
  const html = await page.content();
  return parse(html);
}

async function safeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: "domcontentloaded" });
  } catch {
    // Stop any in-flight loads; LinkedIn's feed often streams forever.
    await page
      .evaluate(() => {
        try {
          window.stop();
        } catch {
          /* noop */
        }
      })
      .catch(() => undefined);
  }
}

/**
 * Wait until `<main>` exists AND has substantive content (LinkedIn's SPA
 * mounts an empty `<main>` immediately, then hydrates after a few API calls).
 *
 * Mirrors the `wait_for_main` Python helper.
 */
async function waitForMain(page: Page): Promise<void> {
  try {
    await page.waitForSelector("main", { timeout: NAV_TIMEOUT_MS });
  } catch {
    // No `<main>` at all means the page redirected somewhere unrenderable.
    return;
  }
  try {
    await page.waitForFunction(
      (minBytes: number) =>
        (document.querySelector("main")?.innerHTML.length ?? 0) > minBytes,
      HYDRATION_MIN_BYTES,
      { timeout: HYDRATION_TIMEOUT_MS }
    );
  } catch {
    // Acceptable — empty subpages legitimately fail this.
  }
  await page.waitForTimeout(POST_HYDRATION_DELAY_MS);
}

async function scrollPage(page: Page, maxScrolls: number = 6): Promise<void> {
  let last = await page.evaluate(() => document.body.scrollHeight ?? 0);
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    const cur = await page.evaluate(() => document.body.scrollHeight ?? 0);
    if (cur === last) break;
    last = cur;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
// Top-card fallbacks (used when /details/{experience|education}/ is empty).
// ---------------------------------------------------------------------------

function experienceFromTopCard(card: {
  company: string | null;
  headline: string | null;
  location: string | null;
}): LinkedInExperience | null {
  if (!card.company || !card.headline) return null;
  return {
    position_title: card.headline,
    company: card.company,
    location: card.location ?? null,
    from_date: null,
    to_date: null,
    description: null,
    linkedin_url: null,
  };
}

function educationFromTopCard(card: { school: string | null }) {
  if (!card.school) return null;
  return {
    institution: card.school,
    degree: null,
    from_date: null,
    to_date: null,
    description: null,
    linkedin_url: null,
  };
}

function normalizeProfileUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    throw new Error(`profile URL must start with https:// — got ${url}`);
  }
  return `${trimmed}/`;
}
