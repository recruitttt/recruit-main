// Tests for LinkedIn parser contamination guards.
//
// These cover the additive filters added on top of the 1:1 Python port:
//   - "People also viewed" sidebar contamination
//   - "Similar profiles" / generic-placeholder tile rejection
//   - empty `<section id="experience">` returns []
//   - aria-busy skeleton rejection
//
// Run via `npx vitest run lib/intake/linkedin`.

import { describe, expect, it } from "vitest";

import { parseExperienceSection, parseEducationSection, extractPLines } from "../parsers";

// ---------------------------------------------------------------------------
// Helpers — build minimal HTML fixtures that mimic LinkedIn's DOM shape.
// ---------------------------------------------------------------------------

function wrapMain(inner: string): string {
  return `<!doctype html><html><body><main>${inner}</main></body></html>`;
}

function realExperienceSection(): string {
  // A real <section id="experience"> with one entry (Acme Corp engineer role).
  return `
    <section id="experience" data-section="experience">
      <h2>Experience</h2>
      <ul>
        <li>
          <p>Senior Software Engineer</p>
          <p>Acme Corp · Full-time</p>
          <p>Jan 2021 – Present · 3 yrs</p>
          <p>San Francisco, CA</p>
          <p>Led the migration of the billing platform from monolith to microservices, improving deployment velocity by 40%.</p>
        </li>
      </ul>
    </section>
  `;
}

function peopleAlsoViewedAside(extras: string = ""): string {
  return `
    <aside aria-label="People also viewed">
      <h2>People also viewed</h2>
      <ul>
        <li>
          <p>John Doe</p>
          <p>Sales Associate at Target</p>
          <p>Connect</p>
        </li>
        <li>
          <p>Jane Smith</p>
          <p>Tutor / Mentor</p>
          <p>Connect</p>
        </li>
        ${extras}
      </ul>
    </aside>
  `;
}

function similarProfilesSection(): string {
  return `
    <section id="similar-profiles">
      <h2>Other similar profiles</h2>
      <ul>
        <li>
          <p>Alex Adams</p>
          <p>Volunteer</p>
          <p>Connect</p>
        </li>
      </ul>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseExperienceSection — contamination guards", () => {
  it("returns ONLY the real experience entry when a 'People also viewed' sidebar is present", () => {
    const html = wrapMain(realExperienceSection() + peopleAlsoViewedAside());
    const out = parseExperienceSection(html);

    expect(out).toHaveLength(1);
    expect(out[0]?.position_title).toBe("Senior Software Engineer");
    expect(out[0]?.company).toBe("Acme Corp");
    expect(out[0]?.from_date).toBe("Jan 2021");
    expect(out[0]?.to_date).toBe("Present");

    // Must NOT have leaked any sidebar content.
    expect(out.some((e) => e.position_title?.toLowerCase().includes("sales associate"))).toBe(false);
    expect(out.some((e) => e.company?.toLowerCase().includes("target"))).toBe(false);
    expect(out.some((e) => e.position_title?.toLowerCase().includes("tutor"))).toBe(false);
    expect(out.some((e) => e.position_title?.toLowerCase().includes("mentor"))).toBe(false);
  });

  it("returns an empty array when <section id='experience'> contains zero entries", () => {
    const emptyExperience = `
      <section id="experience" data-section="experience">
        <h2>Experience</h2>
        <p>Nothing to show — that experience the user has added will appear here.</p>
      </section>
    `;
    const html = wrapMain(emptyExperience);
    const out = parseExperienceSection(html);
    expect(out).toEqual([]);
  });

  it("filters a stray 'Tutor' entry inside 'People also viewed' even with no real section anchor", () => {
    // No <section id="experience"> here — fall back to <main>-wide scan, but
    // the <aside> + heading guards must still scrub the recommendation widget.
    const html = wrapMain(peopleAlsoViewedAside());
    const out = parseExperienceSection(html);
    // No real experience exists anywhere in the page → must be empty.
    expect(out).toEqual([]);
    expect(out.some((e) => e.position_title?.toLowerCase().includes("tutor"))).toBe(false);
  });

  it("rejects entries from 'Other similar profiles' sections", () => {
    const html = wrapMain(realExperienceSection() + similarProfilesSection());
    const out = parseExperienceSection(html);
    expect(out).toHaveLength(1);
    expect(out[0]?.position_title).toBe("Senior Software Engineer");
    expect(out.some((e) => e.position_title?.toLowerCase().includes("volunteer"))).toBe(false);
    expect(out.some((e) => /alex adams/i.test(e.position_title ?? ""))).toBe(false);
  });

  it("drops aria-busy skeleton placeholder entries", () => {
    const skeleton = `
      <section id="experience" aria-busy="true">
        <h2>Experience</h2>
        <ul>
          <li>
            <p>Loading...</p>
            <p>Loading...</p>
            <p>Jan 2020 – Present</p>
          </li>
        </ul>
      </section>
    `;
    // Skeleton has aria-busy → entire section dropped → falls through to
    // empty `<main>` scan → empty array.
    const html = wrapMain(skeleton);
    const out = parseExperienceSection(html);
    expect(out).toEqual([]);
  });

  it("drops a generic-placeholder entry that has no date AND no description", () => {
    // Even if a single "Sales Associate" line slips past the heading guards,
    // the sanity gate must reject it (no date, no real description).
    const placeholderOnly = `
      <section id="experience" data-section="experience">
        <h2>Experience</h2>
        <ul>
          <li>
            <p>Sales Associate</p>
            <p>Target · Part-time</p>
            <p>Connect</p>
          </li>
        </ul>
      </section>
    `;
    const html = wrapMain(placeholderOnly);
    const out = parseExperienceSection(html);
    expect(out).toEqual([]);
  });

  it("keeps a legitimate 'Sales Associate' role with real dates and description", () => {
    // The placeholder filter only rejects entries with NO date AND NO
    // substantive description. A real role with both must survive.
    const realSalesRole = `
      <section id="experience" data-section="experience">
        <h2>Experience</h2>
        <ul>
          <li>
            <p>Sales Associate</p>
            <p>Best Buy · Part-time</p>
            <p>Jun 2019 – Aug 2020 · 1 yr 3 mos</p>
            <p>Seattle, WA</p>
            <p>Hit top quarterly sales numbers in the home appliances department three quarters running.</p>
          </li>
        </ul>
      </section>
    `;
    const html = wrapMain(realSalesRole);
    const out = parseExperienceSection(html);
    expect(out).toHaveLength(1);
    expect(out[0]?.position_title).toBe("Sales Associate");
    expect(out[0]?.company).toBe("Best Buy");
    expect(out[0]?.from_date).toBe("Jun 2019");
  });

  it("does not pick up <p> tags from outside the experience anchor", () => {
    // Both an experience section AND a sibling section with `<p>` date-shaped
    // text. Only the experience section content must come through.
    const html = wrapMain(`
      ${realExperienceSection()}
      <section id="random-section">
        <h2>Random other content</h2>
        <ul>
          <li>
            <p>Bogus Title</p>
            <p>Wrong Company · Imaginary</p>
            <p>Jan 2010 – Dec 2010</p>
            <p>Should never appear in parsed experience output.</p>
          </li>
        </ul>
      </section>
    `);
    const out = parseExperienceSection(html);
    expect(out).toHaveLength(1);
    expect(out[0]?.position_title).toBe("Senior Software Engineer");
    expect(out.some((e) => /bogus title/i.test(e.position_title ?? ""))).toBe(false);
  });
});

describe("parseEducationSection — contamination guards", () => {
  it("returns empty when <section id='education'> has no entries", () => {
    const html = wrapMain(`
      <section id="education" data-section="education">
        <h2>Education</h2>
        <p>Education that the user has added will appear here.</p>
      </section>
    `);
    const out = parseEducationSection(html);
    expect(out).toEqual([]);
  });

  it("does not include education entries from 'People also viewed' sidebar", () => {
    const realEducation = `
      <section id="education" data-section="education">
        <h2>Education</h2>
        <ul>
          <li>
            <p>Stanford University</p>
            <p>BS, Computer Science</p>
            <p>2015 – 2019</p>
          </li>
        </ul>
      </section>
    `;
    const sidebar = `
      <aside aria-label="People also viewed">
        <h2>People also viewed</h2>
        <ul>
          <li>
            <p>Some Other University</p>
            <p>Random Degree</p>
            <p>2000 – 2004</p>
          </li>
        </ul>
      </aside>
    `;
    const html = wrapMain(realEducation + sidebar);
    const out = parseEducationSection(html);
    expect(out).toHaveLength(1);
    expect(out[0]?.institution).toBe("Stanford University");
    expect(out.some((e) => /some other university/i.test(e.institution ?? ""))).toBe(false);
  });
});

describe("extractPLines — recommendation widget scrub", () => {
  it("strips <aside> blocks entirely", () => {
    const html = wrapMain(`
      <p>Real content</p>
      <aside aria-label="People also viewed">
        <p>Sidebar leak</p>
      </aside>
    `);
    const lines = extractPLines(html);
    expect(lines).toContain("Real content");
    expect(lines).not.toContain("Sidebar leak");
  });

  it("strips aria-busy skeleton blocks", () => {
    const html = wrapMain(`
      <p>Real content</p>
      <div aria-busy="true">
        <p>Loading...</p>
        <p>Loading...</p>
      </div>
    `);
    const lines = extractPLines(html);
    expect(lines).toContain("Real content");
    expect(lines.filter((l) => l === "Loading...").length).toBe(0);
  });

  it("strips <section> blocks whose heading matches a recommendation pattern", () => {
    const html = wrapMain(`
      <p>Real content</p>
      <section>
        <h2>Suggested for you</h2>
        <p>Sidebar leak</p>
      </section>
    `);
    const lines = extractPLines(html);
    expect(lines).toContain("Real content");
    expect(lines).not.toContain("Sidebar leak");
  });
});
