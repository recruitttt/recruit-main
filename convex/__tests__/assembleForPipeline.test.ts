/* eslint-disable @typescript-eslint/no-explicit-any */
//
// Smoke test for `userProfiles.assembleForPipeline`.
//
// We don't have `convex-test` wired up in this project, so we stub the
// minimum `ctx` surface (`db.query(...).withIndex(...).unique()/collect()`,
// `auth.getUserIdentity()`) and invoke the query handler directly. The goal
// is to assert that all four sources (userProfiles, githubSnapshots,
// linkedinSnapshots, repoSummaries + experienceSummaries) end up in the
// merged blob, and that per-repo / per-experience summaries get stitched
// onto the right entries.
//
// Run via `tsx convex/__tests__/assembleForPipeline.test.ts`.

import assert from "node:assert/strict";

import * as userProfiles from "../userProfiles";

type Row = Record<string, any> & { _id: string };
type SeedTables = Record<string, Row[]>;

// Tiny in-memory query builder that supports the chainable surface used by
// the assembler: `query(table).withIndex(name, fn).unique()/collect()`.
class TableQuery {
  private rows: Row[];
  private predicate: ((row: Row) => boolean) | null = null;
  constructor(rows: Row[]) {
    this.rows = rows;
  }
  withIndex(_indexName: string, builder: (q: any) => any) {
    const conditions: Array<(row: Row) => boolean> = [];
    const handle = {
      eq: (field: string, value: unknown) => {
        conditions.push((row) => row[field] === value);
        return handle;
      },
    };
    builder(handle);
    this.predicate = (row) => conditions.every((c) => c(row));
    return this;
  }
  order(_dir: "asc" | "desc") {
    return this;
  }
  async unique() {
    const matches = this.rows.filter((row) =>
      this.predicate ? this.predicate(row) : true
    );
    return matches[0] ?? null;
  }
  async collect() {
    return this.rows.filter((row) =>
      this.predicate ? this.predicate(row) : true
    );
  }
}

function makeCtx(seed: SeedTables, identitySubject: string): any {
  return {
    auth: {
      getUserIdentity: async () => ({ subject: identitySubject }),
    },
    db: {
      query: (table: string) => new TableQuery(seed[table] ?? []),
    },
  };
}

async function main() {
  const userId = "user_test_001";
  const seed: SeedTables = {
    userProfiles: [
      {
        _id: "p1",
        userId,
        profile: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          location: "London",
          links: { github: "https://github.com/ada" },
          experience: [],
          education: [],
          skills: ["analytical engines"],
          prefs: { roles: ["Software Engineer"], locations: ["Remote"] },
          suggestions: [],
          provenance: { name: "chat" },
          log: [],
          updatedAt: "2026-04-25T00:00:00.000Z",
          resume: {
            filename: "ada.pdf",
            uploadedAt: "2026-04-24T00:00:00.000Z",
            rawText: "Ada Lovelace, mathematician.",
          },
        },
        provenance: { name: "chat" },
        log: [],
        updatedAt: "2026-04-25T00:00:00.000Z",
      },
    ],
    githubSnapshots: [
      {
        _id: "g1",
        userId,
        fetchedAt: "2026-04-25T00:00:00.000Z",
        raw: {
          user: {
            login: "ada",
            bio: "Computing pioneer",
            company: "Analytical Engines Inc",
            publicRepos: 12,
            followers: 999,
            location: "London, UK",
          },
          repos: [
            {
              name: "analytical-engine",
              fullName: "ada/analytical-engine",
              description: "First general-purpose computer",
              primaryLanguage: "Babbage",
              stargazerCount: 42,
              url: "https://github.com/ada/analytical-engine",
            },
            {
              name: "notes-on-translation",
              fullName: "ada/notes-on-translation",
              description: "Translator's notes",
              primaryLanguage: "English",
              stargazerCount: 8,
              url: "https://github.com/ada/notes-on-translation",
            },
          ],
        },
      },
    ],
    linkedinSnapshots: [
      {
        _id: "l1",
        userId,
        fetchedAt: "2026-04-25T00:00:00.000Z",
        profileUrl: "https://www.linkedin.com/in/ada-lovelace/",
        raw: {
          name: "Ada Lovelace",
          jobTitle: "Mathematician",
          location: "London, UK",
          about: "Pioneer of programming.",
          profileUrl: "https://www.linkedin.com/in/ada-lovelace/",
          experiences: [
            {
              position_title: "Mathematician",
              company: "Analytical Engines Inc",
              location: "London",
              from_date: "1843",
              to_date: "1852",
              description: "Wrote first algorithm intended to be processed by a machine.",
            },
            {
              position_title: "Translator",
              company: "Royal Society",
              location: "London",
              from_date: "1842",
              to_date: "1843",
              description: "Translated Menabrea's article.",
            },
          ],
          educations: [
            {
              institution: "Private Tutor",
              degree: "Mathematics",
              from_date: "1828",
              to_date: "1835",
            },
          ],
          skills: [{ name: "Mathematics" }, { name: "Programming" }],
        },
      },
    ],
    repoSummaries: [
      {
        _id: "rs1",
        userId,
        repoFullName: "ada/analytical-engine",
        sourceContentHash: "h1",
        summary: {
          oneLineDescription: "First general-purpose mechanical computer concept",
          whatItDoes:
            "Implements a mechanical general-purpose computer with separation of memory (Store) and processing (Mill).",
          keyTechnologies: ["Punch cards", "Mechanical gears"],
          accomplishments: ["Theoretical foundation of modern computing"],
        },
        generatedByModel: "haiku",
        generatedAt: "2026-04-25T00:00:00.000Z",
      },
    ],
    experienceSummaries: [
      {
        _id: "es1",
        userId,
        experienceKey: "Analytical Engines Inc::Mathematician::1843",
        sourceContentHash: "h1",
        summary: {
          roleSummary: "Wrote the first published algorithm intended to be processed by a machine.",
          keyResponsibilities: ["Algorithm design", "Translation work"],
          technologiesMentioned: ["Analytical Engine", "Bernoulli numbers"],
        },
        company: "Analytical Engines Inc",
        position: "Mathematician",
        generatedByModel: "haiku",
        generatedAt: "2026-04-25T00:00:00.000Z",
      },
    ],
    intakeRuns: [],
  };

  // Auth gate
  const ctxWrongUser = makeCtx(seed, "someone-else");
  await assert.rejects(
    () =>
      (userProfiles as any).assembleForPipeline._handler(ctxWrongUser, {
        userId,
      }),
    /Forbidden/,
    "non-owner must be rejected"
  );

  const ctx = makeCtx(seed, userId);
  const result = (await (userProfiles as any).assembleForPipeline._handler(ctx, {
    userId,
  })) as {
    profile: Record<string, any>;
    sources: Record<string, any>;
  } | null;

  assert.ok(result, "assembleForPipeline should return an object when sources exist");
  assert.equal(result!.sources.userProfile, true);
  assert.equal(result!.sources.github, true);
  assert.equal(result!.sources.linkedin, true);
  assert.equal(result!.sources.resume, true);
  assert.equal(result!.sources.repoSummaryCount, 1);
  assert.equal(result!.sources.experienceSummaryCount, 1);

  const merged = result!.profile;
  // ---- base/userProfile ----
  assert.equal(merged.name, "Ada Lovelace");
  assert.equal(merged.email, "ada@example.com");
  assert.ok(merged.resume?.rawText, "resume text should survive the merge");

  // ---- LinkedIn ----
  assert.equal(merged.headline, "Mathematician", "LinkedIn jobTitle → headline");
  assert.equal(merged.summary, "Pioneer of programming.", "LinkedIn about → summary");
  assert.equal(merged.links.linkedin, "https://www.linkedin.com/in/ada-lovelace/");
  assert.equal(merged.experience.length, 2, "two LinkedIn experiences merged");
  assert.equal(merged.education.length, 1, "one LinkedIn education merged");
  assert.ok(
    merged.skills.includes("Mathematics") && merged.skills.includes("Programming"),
    "LinkedIn skills merged into skill set"
  );
  // Existing skill from base profile is preserved.
  assert.ok(
    merged.skills.includes("analytical engines"),
    "base skills kept when LinkedIn merges"
  );

  // ---- GitHub ----
  assert.ok(merged.github, "github enrichment block exists");
  assert.equal(merged.github.username, "ada");
  assert.equal(merged.github.publicRepos, 12);
  assert.equal(merged.github.topRepos.length, 2);
  const ae = merged.github.topRepos.find((r: any) => r.name === "analytical-engine");
  assert.ok(ae, "analytical-engine repo present");
  // ---- Repo summary stitching ----
  assert.match(
    ae.whatItDoes,
    /mechanical general-purpose computer/i,
    "repo summary `whatItDoes` attached to matching topRepo"
  );
  assert.deepEqual(ae.keyTechnologies, ["Punch cards", "Mechanical gears"]);
  assert.deepEqual(ae.accomplishments, [
    "Theoretical foundation of modern computing",
  ]);
  // Repo without a summary stays untouched (no extras).
  const notes = merged.github.topRepos.find(
    (r: any) => r.name === "notes-on-translation"
  );
  assert.ok(notes && notes.whatItDoes === undefined);

  // ---- Experience summary stitching ----
  const mathExp = merged.experience.find(
    (e: any) => e.company === "Analytical Engines Inc"
  );
  assert.ok(mathExp, "matched experience must exist");
  assert.match(mathExp.roleSummary, /first published algorithm/i);
  assert.deepEqual(mathExp.keyResponsibilities, [
    "Algorithm design",
    "Translation work",
  ]);
  assert.deepEqual(mathExp.technologiesMentioned, [
    "Analytical Engine",
    "Bernoulli numbers",
  ]);
  // Experience without a matching summary has no roleSummary.
  const translatorExp = merged.experience.find(
    (e: any) => e.company === "Royal Society"
  );
  assert.ok(translatorExp);
  assert.equal(translatorExp.roleSummary, undefined);

  // ---- Provenance reflects every source that contributed ----
  assert.equal(merged.provenance.experience, "linkedin");
  assert.equal(merged.provenance.education, "linkedin");
  assert.equal(merged.provenance.github, "github");
  assert.equal(merged.provenance.resume, "resume");
  // The base provenance entry from the seed should still survive.
  assert.equal(merged.provenance.name, "linkedin", "linkedin overrode chat for name");

  // ---- Empty case: returns null when there's no data anywhere ----
  const emptyCtx = makeCtx(
    {
      userProfiles: [],
      githubSnapshots: [],
      linkedinSnapshots: [],
      repoSummaries: [],
      experienceSummaries: [],
    },
    userId
  );
  const emptyResult = await (userProfiles as any).assembleForPipeline._handler(
    emptyCtx,
    { userId }
  );
  assert.equal(emptyResult, null, "no data → null");

  console.log("assembleForPipeline smoke test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
