// SDUI parsers for LinkedIn /details/* subpages.
//
// 1:1 TS port of the regex-based parsers from the Python source at
// `lib/intake/linkedin/linkedin-scrape.py` (functions starting with `_sdui_*`).
//
// All functions here are pure: they take an HTML string from `page.content()`
// and return structured records. Driver code (Playwright + Browserbase) lives
// in `scrape.ts`.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2

import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInHonor,
  LinkedInNamedSchema,
  LinkedInPublication,
} from "./types";
import type { z } from "zod";

type LinkedInNamed = z.infer<typeof LinkedInNamedSchema>;

// ---------------------------------------------------------------------------
// Constants — ported verbatim from the Python source's _SDUI_* tables.
// ---------------------------------------------------------------------------

const SDUI_DATE_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}|^\d{4}\s*[-–]|^\d{4}$/;

const SDUI_NOISE_PATTERNS: ReadonlyArray<RegExp> = [
  /^why am i seeing this ad/i,
  /^manage your ad preferences/i,
  /^hide or report this ad/i,
  /^i don.{0,4}t want to see this/i,
  /^tell us why/i,
  /^your feedback will help/i,
  /^it.{0,2}s annoying/i,
  /^i.{0,2}ve seen the same ad/i,
  /^if you think this goes against/i,
  /^report this ad/i,
  /^submit$/i,
  /^connect$/i,
  /^follow$/i,
  /^message$/i,
  /^show all/i,
  /^show more/i,
  /^show less/i,
  /^see more/i,
  /^see less/i,
  /^· \d/i,
  /^about$|^accessibility$|^talent solutions$|^community guidelines$|^careers$/i,
  /^marketing solutions$|^privacy & terms$|^ad choices$|^advertising$/i,
  /^sales solutions$|^mobile$|^small business$|^safety center$/i,
  /^linkedin corporation/i,
  /^questions\?$/i,
  /^visit our help center/i,
  /^manage your account and privacy/i,
  /^go to your settings/i,
  /^recommendation transparency/i,
  /^learn more about recommended/i,
  /^select language/i,
];

const SDUI_SECTION_END_PATTERNS: ReadonlyArray<RegExp> = [
  /^more profiles for you/i,
  /^why am i seeing this ad/i,
  /^people also viewed/i,
  /^you might like/i,
];

const SDUI_EXTRAS_MARKERS: ReadonlyArray<RegExp> = [
  /^grade:/i,
  /^activities and societies:/i,
  /^certificate -/i,
  /\.pdf$/i,
  /^all$/i,
  /^industry knowledge$/i,
  /^tools & technologies$/i,
  /^interpersonal skills$/i,
];

const EMPTY_SECTION_RE = /that .{1,40} (?:adds|has added) will appear here/i;

// Section heading words we strip from the head of the parsed `<p>` list.
const SECTION_HEADINGS: ReadonlyArray<string> = [
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "publications",
  "honors",
  "languages",
  "honors & awards",
  "awards",
];

// ---------------------------------------------------------------------------
// Helpers — `_sdui_is_*`, `_sdui_extract_p_lines`, `_sdui_truncate_section_end`,
// `_sdui_parse_date_range`, `_sdui_parse_company_subline`, `_sdui_resolve_title`.
// ---------------------------------------------------------------------------

export function isNoise(text: string): boolean {
  if (!text || text.length < 2) return true;
  return SDUI_NOISE_PATTERNS.some((p) => p.test(text));
}

export function isExtras(text: string): boolean {
  return SDUI_EXTRAS_MARKERS.some((p) => p.test(text));
}

export function isDate(text: string): boolean {
  if (!text || text.length > 80) return false;
  return SDUI_DATE_RE.test(text);
}

export function sectionEmpty(html: string): boolean {
  const ps = extractPLines(html);
  return ps.slice(0, 5).some((p) => EMPTY_SECTION_RE.test(p));
}

/**
 * Extract every `<p>` text inside the page's `<main>` element. Matches the
 * Python `_sdui_extract_p_lines`. Operates on raw HTML (no DOM) so we don't
 * need a Playwright handle here.
 */
export function extractPLines(html: string): string[] {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  if (!mainMatch) return [];
  let main = mainMatch[1];
  // Strip `<svg>`, `<script>`, `<style>` blocks that hold no readable text.
  main = main.replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, "");
  main = main.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
  main = main.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

  const out: string[] = [];
  const tagRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(main)) !== null) {
    let text = match[1].replace(/<[^>]+>/g, " ");
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    text = text.replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

export function truncateAtSectionEnd(ps: string[]): string[] {
  for (let i = 0; i < ps.length; i++) {
    if (SDUI_SECTION_END_PATTERNS.some((m) => m.test(ps[i]))) {
      return ps.slice(0, i);
    }
  }
  return ps;
}

export function parseDateRange(line: string): {
  fromDate: string | null;
  toDate: string | null;
} {
  const mainPart = line.split("·")[0].trim();
  if (mainPart.includes("–") || mainPart.includes(" - ")) {
    const sep = mainPart.includes("–") ? "–" : " - ";
    const idx = mainPart.indexOf(sep);
    const left = mainPart.slice(0, idx).trim();
    const right = mainPart.slice(idx + sep.length).trim();
    return { fromDate: left || null, toDate: right || null };
  }
  return { fromDate: mainPart || null, toDate: null };
}

export function parseCompanySubline(subline: string): {
  company: string | null;
  employmentType: string | null;
} {
  const parts = subline.split("·").map((p) => p.trim());
  const company = parts[0] ?? null;
  const employmentType = parts.length > 1 ? parts[1] : null;
  return { company: company || null, employmentType: employmentType || null };
}

/**
 * Mirror of `_sdui_resolve_title`. Walks back from the date line to find the
 * title (and optional sub-line) p-tag. Returns the indices into `ps`.
 */
export function resolveTitle(
  ps: string[],
  di: number,
  prevDi: number
): { titleIdx: number | null; subIdx: number | null } {
  for (const offset of [2, 1] as const) {
    const cand = di - offset;
    if (cand > prevDi && cand >= 0 && cand < ps.length && !isNoise(ps[cand]) && !isExtras(ps[cand])) {
      let subIdx: number | null = offset === 2 ? di - 1 : null;
      if (subIdx !== null && (subIdx <= prevDi || isExtras(ps[subIdx]))) {
        subIdx = null;
      }
      return { titleIdx: cand, subIdx };
    }
  }
  return { titleIdx: null, subIdx: null };
}

// ---------------------------------------------------------------------------
// Section parsers — experience, education, skills, publications, honors,
// interests, about, top card.
// ---------------------------------------------------------------------------

export type SectionKind = "experience" | "education";

interface Resolved {
  titleIdx: number;
  subIdx: number | null;
  di: number;
}

/**
 * Port of `_sdui_parse_section`. Parses experience or education entries from
 * the HTML of a `/details/{kind}/` subpage.
 */
export function parseSection(html: string, kind: SectionKind): Array<LinkedInExperience | LinkedInEducation> {
  let ps = extractPLines(html);
  ps = truncateAtSectionEnd(ps);

  // Drop any leading section heading like "Experience" or "Education".
  while (ps.length && SECTION_HEADINGS.includes(ps[0].toLowerCase())) {
    ps.shift();
  }

  const dateIdxs: number[] = [];
  for (let i = 0; i < ps.length; i++) {
    if (isDate(ps[i])) dateIdxs.push(i);
  }

  const resolved: Resolved[] = [];
  for (let n = 0; n < dateIdxs.length; n++) {
    const di = dateIdxs[n];
    const prevDi = n > 0 ? dateIdxs[n - 1] : -1;
    const { titleIdx, subIdx } = resolveTitle(ps, di, prevDi);
    if (titleIdx === null) continue;
    resolved.push({ titleIdx, subIdx, di });
  }

  const out: Array<LinkedInExperience | LinkedInEducation> = [];
  for (let n = 0; n < resolved.length; n++) {
    const { titleIdx, subIdx, di } = resolved[n];
    const title = ps[titleIdx];
    const sub = subIdx !== null ? ps[subIdx] : null;
    const { fromDate, toDate } = parseDateRange(ps[di]);
    const nextTitleIdx = n + 1 < resolved.length ? resolved[n + 1].titleIdx : ps.length;
    const extras = ps.slice(di + 1, nextTitleIdx).filter((p) => !isNoise(p));

    if (kind === "experience") {
      const { company, employmentType } = sub
        ? parseCompanySubline(sub)
        : { company: null, employmentType: null };
      let location: string | null = null;
      let descriptionLines = extras;
      if (extras.length > 0) {
        const first = extras[0];
        if (
          first.includes(",") ||
          ["Remote", "On-site", "Hybrid"].some((tag) => first.includes(tag)) ||
          first.length < 60
        ) {
          location = first;
          descriptionLines = extras.slice(1);
        }
      }
      const description = descriptionLines.join("\n").trim() || null;
      out.push({
        position_title: title,
        company,
        employment_type: employmentType,
        location,
        from_date: fromDate,
        to_date: toDate,
        description,
        linkedin_url: null,
      } as LinkedInExperience & { employment_type: string | null });
    } else {
      const description = extras.join("\n").trim() || null;
      out.push({
        institution: title,
        degree: sub,
        from_date: fromDate,
        to_date: toDate,
        description,
        linkedin_url: null,
      } as LinkedInEducation);
    }
  }

  // Dedup by stable composite key, mirroring the Python tail.
  const seen = new Set<string>();
  const uniq: typeof out = [];
  for (const e of out) {
    const key =
      kind === "experience"
        ? JSON.stringify([
            (e as LinkedInExperience).position_title,
            (e as LinkedInExperience).company,
            (e as LinkedInExperience).from_date,
          ])
        : JSON.stringify([
            (e as LinkedInEducation).institution,
            (e as LinkedInEducation).degree,
            (e as LinkedInEducation).from_date,
          ]);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  return uniq;
}

/** Convenience overloads — narrower return types for callers. */
export function parseExperienceSection(html: string): LinkedInExperience[] {
  return parseSection(html, "experience") as LinkedInExperience[];
}

export function parseEducationSection(html: string): LinkedInEducation[] {
  return parseSection(html, "education") as LinkedInEducation[];
}

/**
 * Port of `_sdui_parse_skills`. Strips the title heading, then walks the
 * remaining `<p>` lines pulling out skill name + endorsement count + the
 * "X experiences at Y" context lines.
 */
export interface ParsedSkill {
  name: string;
  endorsements: number | null;
  context: string[];
}

export function parseSkills(html: string): ParsedSkill[] {
  if (sectionEmpty(html)) return [];
  let ps = extractPLines(html);
  ps = truncateAtSectionEnd(ps);
  while (ps.length && ps[0].toLowerCase() === "skills") ps.shift();

  const out: ParsedSkill[] = [];
  let i = 0;
  while (i < ps.length) {
    const p = ps[i];
    if (isNoise(p) || isExtras(p)) {
      i += 1;
      continue;
    }
    const isSkillName =
      !isDate(p) &&
      !/^\d+\s+(endorsement|experience)/i.test(p) &&
      !/^(Researcher|Founder|Intern|Engineer|Developer|CEO|CTO|Lead)\s+at\s+/i.test(p) &&
      !/^\d+\s+experiences? at/i.test(p) &&
      p.length < 80;
    if (isSkillName) {
      const entry: ParsedSkill = { name: p, endorsements: null, context: [] };
      let j = i + 1;
      while (j < ps.length) {
        const nxt = ps[j];
        if (isNoise(nxt)) {
          j += 1;
          continue;
        }
        const endorsementMatch = nxt.match(/^(\d+)\s+endorsement/i);
        if (endorsementMatch) {
          entry.endorsements = parseInt(endorsementMatch[1], 10);
          j += 1;
          continue;
        }
        if (
          /^(?:Researcher|Founder|Intern|Engineer|Developer|CEO|CTO|Lead).*\s+at\s+/i.test(nxt) ||
          /^\d+\s+experiences? at/i.test(nxt)
        ) {
          entry.context.push(nxt);
          j += 1;
          continue;
        }
        break;
      }
      out.push(entry);
      i = j;
    } else {
      i += 1;
    }
  }
  return out;
}

/** Convert ParsedSkill -> LinkedInNamed (the snapshot shape). */
export function parsedSkillsToNamed(skills: ParsedSkill[]): LinkedInNamed[] {
  return skills.map((s) => ({ name: s.name, category: null }));
}

/** Port of `_sdui_parse_publications`. */
export function parsePublications(html: string): LinkedInPublication[] {
  if (sectionEmpty(html)) return [];
  let ps = extractPLines(html);
  ps = truncateAtSectionEnd(ps);
  while (ps.length && ps[0].toLowerCase() === "publications") ps.shift();

  const out: LinkedInPublication[] = [];
  let i = 0;
  while (i + 1 < ps.length) {
    const title = ps[i];
    const venueLine = ps[i + 1];
    if (isNoise(title) || isNoise(venueLine)) {
      i += 1;
      continue;
    }
    if (venueLine.includes(" · ") && /\d{4}/.test(venueLine)) {
      const lastSep = venueLine.lastIndexOf(" · ");
      const venue = venueLine.slice(0, lastSep).trim();
      const date = venueLine.slice(lastSep + 3).trim();
      let description: string | null = null;
      let j = i + 2;
      if (
        j < ps.length &&
        !isNoise(ps[j]) &&
        !ps[j].includes(" · ") &&
        ps[j].toLowerCase() !== "other authors"
      ) {
        description = ps[j];
        j += 1;
      }
      if (j < ps.length && ps[j].toLowerCase() === "other authors") j += 1;
      out.push({
        title,
        authors: [],
        venue,
        date,
        url: null,
        description,
      });
      i = j;
    } else {
      i += 1;
    }
  }
  return out;
}

/** Port of `_sdui_parse_honors`. */
export function parseHonors(html: string): LinkedInHonor[] {
  if (sectionEmpty(html)) return [];
  let ps = extractPLines(html);
  ps = truncateAtSectionEnd(ps);
  while (
    ps.length &&
    ["honors & awards", "honors", "awards"].includes(ps[0].toLowerCase())
  ) {
    ps.shift();
  }

  const out: LinkedInHonor[] = [];
  let i = 0;
  while (i + 1 < ps.length) {
    const title = ps[i];
    const date = ps[i + 1];
    if (isNoise(title) || isNoise(date)) {
      i += 1;
      continue;
    }
    if (
      isDate(date) ||
      /^[A-Za-z]{3,9}\s+\d{4}$/.test(date) ||
      date.toLowerCase().includes("various")
    ) {
      out.push({ title, issuer: null, date, description: null });
      i += 2;
    } else {
      i += 1;
    }
  }
  return out;
}

export interface ParsedInterest {
  name: string;
  headline: string | null;
  followers: number | null;
}

/** Port of `_sdui_parse_interests`. */
export function parseInterests(html: string): ParsedInterest[] {
  if (sectionEmpty(html)) return [];
  let ps = extractPLines(html);
  ps = truncateAtSectionEnd(ps);
  while (ps.length && ps[0].toLowerCase() === "interests") ps.shift();

  const out: ParsedInterest[] = [];
  let i = 0;
  while (i + 3 < ps.length) {
    const name = ps[i];
    const rel = ps[i + 1];
    const headline = ps[i + 2];
    const followers = ps[i + 3];
    if (isNoise(name)) {
      i += 1;
      continue;
    }
    if (rel.startsWith("·") && /\d[\d,]*\s+followers?/i.test(followers)) {
      const m = followers.match(/^([\d,]+)\s+follower/);
      const numFollowers = m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
      out.push({ name, headline, followers: numFollowers });
      i += 4;
    } else {
      i += 1;
    }
  }
  return out;
}

export function parsedInterestsToNamed(interests: ParsedInterest[]): LinkedInNamed[] {
  return interests.map((it) => ({ name: it.name, category: null }));
}

// ---------------------------------------------------------------------------
// About + top card — these used DOM helpers in Python; ported to HTML regex
// for parity in TS (we still have the page if we want a richer DOM-based path).
// ---------------------------------------------------------------------------

/** Returns the cleaned About text or null. */
export function parseAbout(html: string): string | null {
  // Try the explicit aria-label="About" section first.
  const aboutSectionRe =
    /<section[^>]*(?:aria-label="About"|aria-labelledby="[^"]*about[^"]*"|data-section="summary")[^>]*>([\s\S]*?)<\/section>/i;
  const sectionMatch = html.match(aboutSectionRe);
  if (sectionMatch) {
    const text = extractTextFromBlock(sectionMatch[1]);
    if (text && text.length > 20) return text;
  }

  // Fall back to scanning every <section> for a heading containing "about".
  const sectionRe = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match: RegExpExecArray | null;
  while ((match = sectionRe.exec(html)) !== null) {
    const inner = match[1];
    const headerMatch = inner.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i);
    if (!headerMatch) continue;
    const headerText = stripTags(headerMatch[1]).trim().toLowerCase();
    if (!headerText.includes("about")) continue;
    const text = extractTextFromBlock(inner);
    if (text && text.length > 20) return text;
  }
  return null;
}

export interface TopCard {
  name: string | null;
  headline: string | null;
  location: string | null;
  company: string | null;
  school: string | null;
  openToWork: boolean;
}

/**
 * Parse the page header card on the main profile page. Looks at every
 * `<main> <section>` and picks the first that yields a name or headline.
 */
export function parseTopCard(html: string, pageTitle: string = ""): TopCard {
  const sectionRe = /<section[^>]*>([\s\S]*?)<\/section>/g;
  let match: RegExpExecArray | null;
  while ((match = sectionRe.exec(html)) !== null) {
    const text = extractTextFromBlock(match[1]);
    if (!text) continue;
    const card = parseTopCardLines(text.split("\n"), pageTitle);
    if (card.name || card.headline) return card;
  }
  return parseTopCardLines([], pageTitle);
}

function parseTopCardLines(rawLines: string[], titleStr: string): TopCard {
  const clean = dedupe(rawLines.map(normalizeLine).filter((l): l is string => Boolean(l)));
  const titleName = (titleStr || "").split("|")[0].trim() || null;
  let name: string | null = null;
  if (titleName && !["linkedin", "feed"].includes(titleName.toLowerCase())) {
    name = clean.find((line) => line === titleName) ?? titleName;
  }
  if (!name) {
    name = clean.find((line) => !isTopCardNoise(line)) ?? null;
  }

  const startIdx = name && clean.includes(name) ? clean.indexOf(name) + 1 : 0;
  const afterName = clean.slice(startIdx);
  const headline =
    afterName.find(
      (line) => !isTopCardNoise(line) && !looksLikeLocation(line) && !looksLikeOrgSchoolLine(line)
    ) ?? null;
  const afterHeadline = headline
    ? afterName.slice(afterName.indexOf(headline) + 1)
    : afterName;
  const orgLine = afterHeadline.find((line) => looksLikeOrgSchoolLine(line)) ?? null;
  const location = afterHeadline.find((line) => looksLikeLocation(line)) ?? null;

  let company: string | null = null;
  let school: string | null = null;
  if (orgLine) {
    const parts = orgLine
      .split("·")
      .map((p) => p.trim())
      .filter(Boolean);
    company = parts[0] ?? null;
    school = parts.length > 1 ? parts[1] : null;
  }

  return {
    name,
    headline,
    location,
    company,
    school,
    openToWork: clean.some((line) => line.toLowerCase() === "open to work"),
  };
}

// ---------------------------------------------------------------------------
// Top-card text predicates — minimal ports of the Python helpers we still
// rely on inside `parseTopCardLines`.
// ---------------------------------------------------------------------------

function isTopCardNoise(text: string): boolean {
  const lower = text.toLowerCase();
  if (isDetailNoise(text)) return true;
  return (
    lower.endsWith("connections") ||
    lower.endsWith("followers") ||
    [
      "0 notifications",
      "contact info",
      "open to",
      "add section",
      "visit my website",
      "show details",
    ].includes(lower)
  );
}

function isDetailNoise(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "",
    "·",
    "like",
    "comment",
    "repost",
    "send",
    "show all",
    "show more",
    "message",
    "connect",
    "follow",
    "submit",
    "get started",
    "report this ad",
    "… more",
  ].includes(lower);
}

function isRelativeActivityDate(text: string): boolean {
  return /^\d+\s*(s|m|h|d|w|mo|yr)s?\s*(?:[• ].*)?$/i.test(text.trim());
}

function isLinkedInDateLine(text: string): boolean {
  if (isRelativeActivityDate(text)) return false;
  const hasYear = /\b(19|20)\d{2}\b/.test(text);
  const lower = text.toLowerCase();
  return hasYear && (text.includes("-") || lower.includes("present") || text.includes("·"));
}

function looksLikeLocation(text: string): boolean {
  const lower = text.toLowerCase();
  if (isLinkedInDateLine(text)) return false;
  if (["Remote", "Hybrid", "On-site", "Onsite"].some((k) => text.includes(k))) {
    return true;
  }
  const locationWords = [
    "united states",
    "canada",
    "india",
    "united kingdom",
    "germany",
    "france",
    "singapore",
    "australia",
    "area",
  ];
  return text.includes(",") || locationWords.some((w) => lower.includes(w));
}

function looksLikeOrgSchoolLine(text: string): boolean {
  if (!text.includes("·")) return false;
  if (isLinkedInDateLine(text) || isRelativeActivityDate(text)) return false;
  return !isDetailNoise(text);
}

// ---------------------------------------------------------------------------
// Tiny HTML helpers — used only by parseAbout + parseTopCard.
// ---------------------------------------------------------------------------

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns one cleaned, newline-joined chunk for an arbitrary HTML block. */
function extractTextFromBlock(html: string): string {
  const block = html
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
  // Prefer aria-hidden spans (LinkedIn duplicates each visible string into one
  // for screen-readers and one with aria-hidden=true for sighted users).
  const ariaHiddenSpans: string[] = [];
  const spanRe = /<span[^>]*aria-hidden="true"[^>]*>([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(block)) !== null) {
    const t = stripTags(m[1]);
    if (t) ariaHiddenSpans.push(t);
  }
  if (ariaHiddenSpans.length > 0) {
    return dedupe(ariaHiddenSpans).join("\n");
  }
  // Fall back to all visible text minus boilerplate verbs.
  const lines = stripTags(block)
    .split(/\s{2,}|\n/)
    .map((l) => l.trim())
    .filter((l) => l && !["about", "show all", "show more", "see more"].includes(l.toLowerCase()));
  return dedupe(lines).join("\n");
}

function dedupe(values: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeLine(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).split(/\s+/).filter(Boolean).join(" ");
  return text || null;
}
