import assert from "node:assert/strict";

import { buildLinkedInMerge } from "../lib/intake/shared/mapper";
import { experienceKey } from "../lib/intake/github/per-experience";
import { parseExperienceSection, type LinkedInSnapshot } from "../lib/intake/linkedin";

const duplicateSnapshot: LinkedInSnapshot = {
  fetchedAt: "2026-04-26T00:00:00.000Z",
  profileUrl: "https://linkedin.com/in/test",
  name: "Test User",
  about: null,
  location: null,
  openToWork: false,
  jobTitle: null,
  company: null,
  experiences: [
    {
      position_title: "Software Engineer",
      company: "Acme",
      location: "San Francisco",
      from_date: "Jan 2024",
      to_date: "Present",
      description: "Built internal tooling.",
      linkedin_url: null,
    },
    {
      position_title: " Software Engineer ",
      company: "ACME",
      location: "San Francisco",
      from_date: "Jan. 2024",
      to_date: "Present",
      description: "Built internal tooling and internal developer platforms.",
      linkedin_url: null,
    },
    {
      position_title: "Senior Software Engineer",
      company: "Acme",
      location: "San Francisco",
      from_date: "Jan 2025",
      to_date: "Present",
      description: "Led platform work.",
      linkedin_url: null,
    },
  ],
  educations: [],
  skills: [],
  projects: [],
  certifications: [],
  publications: [],
  honors: [],
  languages: [],
  interests: [],
  accomplishments: [],
  contacts: [],
};

const linked = buildLinkedInMerge(duplicateSnapshot);

assert.equal(linked.experience.length, 2);
assert.deepEqual(
  linked.experience.map((item) => `${item.title} @ ${item.company}`),
  ["Software Engineer @ Acme", "Senior Software Engineer @ Acme"],
);
assert.equal(
  linked.experience[0]?.description,
  "Built internal tooling and internal developer platforms.",
);
assert.deepEqual(Object.keys(linked.provenance).filter((key) => key.startsWith("experience[")), [
  "experience[Acme::Software Engineer]",
  "experience[Acme::Senior Software Engineer]",
]);

assert.equal(
  experienceKey(duplicateSnapshot.experiences[0]),
  experienceKey(duplicateSnapshot.experiences[1]),
);
assert.notEqual(
  experienceKey(duplicateSnapshot.experiences[0]),
  experienceKey(duplicateSnapshot.experiences[2]),
);

const contaminatedHtml = `
  <main>
    <section>
      <h2>Experience</h2>
      <p>Founder</p>
      <p>Own Company · Full-time</p>
      <p>Jan 2023 – Present · 1 yr 4 mos</p>
      <p>Built the candidate profile system.</p>
    </section>
    <ul>
      <li>
        <a href="https://www.linkedin.com/in/suggested-person/">
          <p>Suggested Person</p>
          <p>Sales Associate</p>
          <p>Target</p>
          <p>Jan 2020 – Present</p>
          <p>Retail operations and customer support.</p>
        </a>
      </li>
    </ul>
  </main>
`;

const parsed = parseExperienceSection(contaminatedHtml);
assert.deepEqual(
  parsed.map((item) => `${item.position_title} @ ${item.company}`),
  ["Founder @ Own Company"],
);

console.log("linkedin experience dedupe test passed");
