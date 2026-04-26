import assert from "node:assert/strict";

import {
  dedupeLinkedInEducations,
  dedupeLinkedInExperiences,
  dedupeLinkedInNamed,
  dedupeLinkedInSnapshot,
  linkedInEducationDedupeKey,
  linkedInExperienceDedupeKey,
  normalizeCompany,
  normalizeDate,
  normalizeDegree,
  normalizeInstitution,
  normalizeSkillName,
  normalizeTitle,
} from "../lib/intake/linkedin/experience-dedupe";
import {
  applyReviewedFields,
  reviewLinkedInDuplicates,
} from "../lib/intake/linkedin/duplicate-reviewer";
import type { LinkedInSnapshot } from "../lib/intake/linkedin";

// ---------------------------------------------------------------------------
// Normalizers — collapse cosmetic variants into the same key.
// ---------------------------------------------------------------------------

assert.equal(normalizeCompany("Acme Inc."), normalizeCompany("acme"));
assert.equal(normalizeCompany("Acme Corp"), normalizeCompany("acme"));
assert.equal(normalizeCompany("OpenAI, LLC"), "openai");
assert.equal(normalizeTitle("Sr. Software Engineer"), "senior software engineer");
assert.equal(normalizeTitle("Research & Development Lead"), "research and development lead");
assert.equal(normalizeInstitution("The Massachusetts Institute of Technology"), "massachusetts institute of technology");
assert.equal(normalizeDegree("B.S."), "bs");
assert.equal(normalizeSkillName("Machine_Learning"), "machinelearning");
assert.equal(normalizeSkillName("Front-End"), "frontend");
assert.equal(normalizeSkillName("Front End"), normalizeSkillName("Front-End"));
assert.equal(normalizeDate("Jan 2024"), "2024-01");
assert.equal(normalizeDate("Jan. 2024"), "2024-01");
assert.equal(normalizeDate("January 2024"), "2024-01");
assert.equal(normalizeDate("2024-1"), "2024-01");
assert.equal(normalizeDate("2024"), "2024");

// ---------------------------------------------------------------------------
// Education dedupe — same school+degree collapses, different programs stay.
// ---------------------------------------------------------------------------

const dedupedEducations = dedupeLinkedInEducations([
  {
    institution: "Stanford University",
    degree: "B.S. Computer Science",
    from_date: "2018",
    to_date: "2022",
    description: "Honors track.",
    linkedin_url: null,
  },
  {
    institution: "stanford",
    degree: "BS Computer Science",
    from_date: "2018",
    to_date: "2022",
    description: "Coursework included AI, systems, and HCI.",
    linkedin_url: null,
  },
  {
    institution: "Stanford University",
    degree: "M.S. Computer Science",
    from_date: "2022",
    to_date: "2023",
    description: null,
    linkedin_url: null,
  },
]);

assert.equal(dedupedEducations.length, 2);
assert.equal(
  dedupedEducations[0]?.description,
  "Coursework included AI, systems, and HCI.",
  "longer description should win on dedupe",
);
assert.equal(linkedInEducationDedupeKey(dedupedEducations[0]!), linkedInEducationDedupeKey(dedupedEducations[0]!));

// ---------------------------------------------------------------------------
// Skills dedupe — repeated names with case/punctuation variants collapse.
// ---------------------------------------------------------------------------

const dedupedSkills = dedupeLinkedInNamed([
  { name: "TypeScript", category: null },
  { name: "typescript", category: null },
  { name: "Type-Script", category: null },
  { name: "React", category: null },
  { name: "react", category: null },
]);

assert.deepEqual(
  dedupedSkills.map((s) => s.name),
  ["TypeScript", "React"],
);

// ---------------------------------------------------------------------------
// Experience: company-suffix variant should not produce two entries.
// ---------------------------------------------------------------------------

const dedupedExp = dedupeLinkedInExperiences([
  {
    position_title: "Senior Software Engineer",
    company: "Acme Inc.",
    location: "SF",
    from_date: "Jan 2024",
    to_date: "Present",
    description: "Built things.",
    linkedin_url: null,
  },
  {
    position_title: "Sr. Software Engineer",
    company: "ACME",
    location: "SF",
    from_date: "January 2024",
    to_date: "Present",
    description: "Built things and platforms.",
    linkedin_url: null,
  },
]);
assert.equal(dedupedExp.length, 1);
assert.equal(dedupedExp[0]?.description, "Built things and platforms.");
assert.equal(
  linkedInExperienceDedupeKey({
    company: "Acme Inc.",
    position_title: "Sr. Software Engineer",
    from_date: null,
  }),
  linkedInExperienceDedupeKey({
    company: "ACME",
    position_title: "Senior Software Engineer",
    from_date: null,
  }),
);

// ---------------------------------------------------------------------------
// Snapshot-level dedupe — every list field is collapsed in one call.
// ---------------------------------------------------------------------------

const snapshot: LinkedInSnapshot = {
  fetchedAt: "2026-04-26T00:00:00.000Z",
  profileUrl: "https://linkedin.com/in/x",
  name: "X",
  about: null,
  location: null,
  openToWork: false,
  jobTitle: null,
  company: null,
  experiences: [
    { position_title: "Engineer", company: "Globex", location: null, from_date: null, to_date: null, description: null, linkedin_url: null },
    { position_title: "engineer", company: "GLOBEX", location: null, from_date: null, to_date: null, description: null, linkedin_url: null },
  ],
  educations: [
    { institution: "MIT", degree: "BS", from_date: null, to_date: null, description: null, linkedin_url: null },
    { institution: "mit", degree: "B.S.", from_date: null, to_date: null, description: null, linkedin_url: null },
  ],
  skills: [
    { name: "Go", category: null },
    { name: "go", category: null },
  ],
  projects: [],
  certifications: [],
  publications: [],
  honors: [],
  languages: [],
  interests: [],
  accomplishments: [],
  contacts: [],
};

const cleaned = dedupeLinkedInSnapshot(snapshot);
assert.equal(cleaned.experiences.length, 1);
assert.equal(cleaned.educations.length, 1);
assert.equal(cleaned.skills.length, 1);

// ---------------------------------------------------------------------------
// Reviewer fallback — without OPENAI_API_KEY the patch passes through.
// ---------------------------------------------------------------------------

(async () => {
  // Force the no_api_key fallback path regardless of the host env so the
  // test verifies the safety net rather than hitting OpenAI.
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const original = {
      experience: [
        { company: "Acme", title: "Engineer" },
        { company: "Acme", title: "Engineer" },
      ],
      education: [{ school: "MIT", degree: "BS" }],
      skills: ["Go", "Go"],
    };
    const result = await reviewLinkedInDuplicates(original);
    assert.equal(result.status.ok, false);
    assert.deepEqual(result.patch.experience, original.experience);
    assert.deepEqual(result.patch.skills, original.skills);

    const merged = applyReviewedFields(
      { experience: original.experience, skills: original.skills },
      { experience: [{ company: "Acme", title: "Engineer" }], skills: ["Go"] },
    );
    assert.equal(merged.experience?.length, 1);
    assert.equal(merged.skills?.length, 1);

    console.log("linkedin dedupe fields test passed");
  } finally {
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  }
})();
