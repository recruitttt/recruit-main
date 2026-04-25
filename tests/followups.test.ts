import assert from "node:assert/strict";

import {
  addBusinessDays,
  buildDefaultFollowUpTasks,
  generateOutreachDraft,
  isFollowUpDue,
  nextOpenFollowUpAt,
} from "../lib/followups";

const friday = "2026-04-24T16:00:00.000Z";

assert.equal(addBusinessDays(friday, 1), "2026-04-27T16:00:00.000Z");
assert.equal(addBusinessDays(friday, 5), "2026-05-01T16:00:00.000Z");

const defaults = buildDefaultFollowUpTasks(friday);
assert.deepEqual(defaults.map((task) => task.channel), ["email", "linkedin"]);
assert.equal(defaults[0].scheduledFor, "2026-05-01T16:00:00.000Z");
assert.equal(defaults[1].scheduledFor, "2026-05-12T16:00:00.000Z");

assert.equal(
  nextOpenFollowUpAt([
    { state: "sent_manually", scheduledFor: "2026-04-26T16:00:00.000Z" },
    { state: "draft_ready", scheduledFor: "2026-05-03T16:00:00.000Z" },
    { state: "scheduled", scheduledFor: "2026-05-01T16:00:00.000Z" },
  ]),
  "2026-05-01T16:00:00.000Z"
);

assert.equal(
  isFollowUpDue(
    { state: "scheduled", scheduledFor: "2026-05-01T16:00:00.000Z" },
    "2026-05-01T16:00:00.000Z"
  ),
  true
);
assert.equal(
  isFollowUpDue(
    { state: "skipped", scheduledFor: "2026-05-01T16:00:00.000Z" },
    "2026-05-02T16:00:00.000Z"
  ),
  false
);

const email = generateOutreachDraft({
  channel: "email",
  application: {
    company: "Linear",
    title: "Product Engineer",
    appliedAt: friday,
    jobUrl: "https://jobs.example/linear",
  },
  profile: {
    name: "Mo Hoshir",
    skills: ["TypeScript", "React", "AI agents", "Postgres"],
  },
});

assert.match(email.subject ?? "", /Product Engineer/);
assert.match(email.body, /I applied on Apr 24, 2026/);
assert.match(email.body, /TypeScript, React, AI agents, Postgres/);
assert.doesNotMatch(email.body, /\bsent\b automatically/i);

const linkedin = generateOutreachDraft({
  channel: "linkedin",
  application: {
    company: "Vercel",
    title: "Design Engineer",
  },
  profile: { name: "Mo Hoshir" },
});

assert.equal(linkedin.subject, undefined);
assert.match(linkedin.body, /recently applied/);

console.log("Follow-up scheduling and draft tests passed");
