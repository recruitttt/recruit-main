import assert from "node:assert/strict";

import { clearProfile, mergeProfile, PROFILE_STORAGE_KEY, readProfile } from "../lib/profile";
import { installMemoryWindow } from "./helpers";

const storage = installMemoryWindow();

storage.setItem(PROFILE_STORAGE_KEY, "{not json");
const corrupt = readProfile();
assert.equal(corrupt.name, undefined);
assert.deepEqual(corrupt.skills, []);
assert.deepEqual(corrupt.prefs, { roles: [], locations: [] });

clearProfile();
mergeProfile({ name: "Jordan QA Candidate" }, "chat", "Got your name");
mergeProfile({ email: "jordan.qa+recruit-live-20260425@example.com" }, "chat", "Got your email");
mergeProfile(
  {
    resume: { filename: "recruit-live-qa-resume.pdf", uploadedAt: "2026-04-25T12:00:00.000Z", rawText: "Jordan QA Candidate product engineer AI systems." },
    location: "San Francisco, CA",
    experience: [{ company: "QA Systems", title: "Product Engineer" }],
    education: [{ school: "State University", degree: "BS", field: "Computer Science" }],
    skills: ["TypeScript", "AI systems", "Product engineering"],
  },
  "resume",
  "Read your resume"
);
mergeProfile(
  {
    name: "Jordana Qi",
    location: "Rochester, NY",
    experience: [{ company: "Other Co", title: "Unrelated role" }],
    education: [{ school: "Other School" }],
    skills: ["Renovation", "Hospitality"],
  },
  "linkedin",
  "Read your LinkedIn"
);

const profile = readProfile();
assert.equal(profile.name, "Jordan QA Candidate");
assert.equal(profile.email, "jordan.qa+recruit-live-20260425@example.com");
assert.equal(profile.location, "San Francisco, CA");
assert.equal(profile.experience[0]?.company, "QA Systems");
assert.equal(profile.education[0]?.school, "State University");
assert.deepEqual(profile.skills, ["TypeScript", "AI systems", "Product engineering"]);
assert.ok(profile.suggestions.some((suggestion) => suggestion.field === "name" && suggestion.suggestedValue === "Jordana Qi"));
assert.ok(profile.suggestions.some((suggestion) => suggestion.field === "location" && suggestion.suggestedValue === "Rochester, NY"));
assert.equal(profile.provenance.name, "chat");
assert.equal(profile.provenance.experience, "resume");
assert.ok(profile.log.some((entry) => entry.source === "linkedin" && entry.level === "warning"));

const suggestionCount = profile.suggestions.length;
mergeProfile(
  {
    name: "Jordana Qi",
    location: "Rochester, NY",
    experience: [{ company: "Other Co", title: "Unrelated role" }],
    education: [{ school: "Other School" }],
    skills: ["Renovation", "Hospitality"],
  },
  "linkedin",
  "Read your LinkedIn again"
);
assert.equal(readProfile().suggestions.length, suggestionCount);

mergeProfile(
  {
    name: "",
    email: "",
    experience: [],
    education: [],
    skills: [],
    prefs: { roles: [], locations: [], minSalary: "" },
  },
  "chat",
  "Ignored empty update"
);
const afterEmpty = readProfile();
assert.equal(afterEmpty.name, "Jordan QA Candidate");
assert.equal(afterEmpty.email, "jordan.qa+recruit-live-20260425@example.com");
assert.equal(afterEmpty.location, "San Francisco, CA");
assert.deepEqual(afterEmpty.skills, ["TypeScript", "AI systems", "Product engineering"]);

console.log("profile merge authority test passed");
