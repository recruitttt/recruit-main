import assert from "node:assert/strict";
import {
  DEFAULT_APPLY_SERVICE_SETTINGS,
  buildRecruit2ApplyPayload,
  createApplyRunStore,
  groupDeferredQuestions,
  normalizeApplyBatchRequest,
  shortlistJobsForProfile,
  toRecruit2Profile,
  type ApplyServiceProfile,
  type JobCandidate,
  recruit2ApplyApiBaseUrl,
} from "../lib/apply-service";

const profile: ApplyServiceProfile = {
  name: "Om Sanan",
  email: "om@example.com",
  phone: "914-282-7737",
  location: "Pasadena, CA",
  links: {
    github: "https://github.com/anti-integral",
    linkedin: "https://www.linkedin.com/in/om-sanan/",
    website: "https://dzwater.org/",
  },
  workAuthorization: {
    citizenship: ["United States"],
    authorizedToWorkUS: true,
    requiresSponsorshipNow: false,
    requiresSponsorshipFuture: false,
  },
  skills: ["Python", "TypeScript", "React", "AI agents"],
  preferences: {
    roles: ["Software Engineer", "AI Engineer"],
    locations: ["New York", "San Francisco", "Remote"],
  },
  experience: [
    {
      company: "NASA JPL",
      title: "Research Intern",
      description: "Built AI and robotics software.",
    },
  ],
  education: [
    {
      school: "California Institute of Technology",
      degree: "BS",
      field: "Computer Science",
    },
  ],
};

const jobs: JobCandidate[] = [
  {
    id: "job_ai",
    company: "Acme AI",
    title: "AI Engineer",
    url: "https://jobs.ashbyhq.com/acme/111",
    applicationUrl: "https://jobs.ashbyhq.com/acme/111/application",
    location: "New York",
    description: "Build Python and TypeScript agents for customers.",
    requirements: ["Python", "TypeScript"],
  },
  {
    id: "job_sales",
    company: "Acme Sales",
    title: "Account Executive",
    url: "https://jobs.ashbyhq.com/acme/222",
    location: "Austin",
    description: "Own outbound sales campaigns.",
    requirements: ["Salesforce"],
  },
];

const shortlisted = shortlistJobsForProfile({ jobs, profile, limit: 2 });
assert.equal(shortlisted[0]?.job.id, "job_ai");
assert.ok(shortlisted[0]?.score ?? 0 > (shortlisted[1]?.score ?? 0));
assert.ok(shortlisted[0]?.rationale.includes("skill match"));

const recruit2Profile = toRecruit2Profile(profile, {
  resume: {
    jobId: "job_ai",
    filename: "Om_Sanan_Acme_AI.pdf",
    path: "/tmp/Om_Sanan_Acme_AI.pdf",
    byteLength: 12_345,
  },
});
assert.equal(recruit2Profile.identity.firstName, "Om");
assert.equal(recruit2Profile.identity.lastName, "Sanan");
assert.equal(recruit2Profile.contact.phone, "914-282-7737");
assert.equal(recruit2Profile.links.github, "https://github.com/anti-integral");
assert.equal(recruit2Profile.workAuth.authorizedUS, true);
assert.equal(recruit2Profile.workAuth.needsSponsorshipNow, false);
assert.equal(recruit2Profile.workAuth.needsSponsorshipFuture, false);
assert.equal(recruit2Profile.workAuth.citizenshipStatus, "U.S. citizen");
assert.equal(recruit2Profile.files.resumePath, "/tmp/Om_Sanan_Acme_AI.pdf");

const normalized = normalizeApplyBatchRequest({
  jobs,
  profile,
  tailoredResumes: {
    job_ai: {
      jobId: "job_ai",
      filename: "Om_Sanan_Acme_AI.pdf",
      path: "/tmp/Om_Sanan_Acme_AI.pdf",
      byteLength: 12_345,
    },
  },
  settings: {
    maxApplicationsPerRun: 20,
    maxConcurrentApplications: 20,
    maxConcurrentPerDomain: 20,
    computerUseModel: "gpt-5.4-nano",
  },
  mode: "auto-strict",
  consent: { externalTargetsApproved: true },
});
assert.equal(normalized.ok, true);
assert.equal(normalized.ok ? normalized.value.jobs.length : 0, 2);
assert.equal(normalized.ok ? normalized.value.settings.maxConcurrentApplications : 0, 20);
assert.equal(normalized.ok ? normalized.value.settings.maxConcurrentPerDomain : 0, 20);

const duplicateNormalized = normalizeApplyBatchRequest({
  jobs: [
    jobs[0]!,
    { ...jobs[0]!, id: "duplicate", url: "https://jobs.ashbyhq.com/acme/111?utm=1" },
  ],
  profile,
  consent: { externalTargetsApproved: true },
});
assert.equal(duplicateNormalized.ok, true);
assert.equal(duplicateNormalized.ok ? duplicateNormalized.value.jobs.length : 0, 1);

const tooMany = normalizeApplyBatchRequest({
  jobs: Array.from({ length: 21 }, (_, index) => ({
    id: `job_${index}`,
    company: "Acme",
    title: `Engineer ${index}`,
    url: `https://jobs.example.com/${index}`,
  })),
  profile,
  consent: { externalTargetsApproved: true },
});
assert.deepEqual(tooMany, {
  ok: false,
  reason: "too_many_jobs",
  status: 400,
  maxApplicationsPerRun: 20,
});

const payload = buildRecruit2ApplyPayload(normalized.ok ? normalized.value : (() => {
  throw new Error("normalization failed");
})());
assert.equal(payload.targets.length, 2);
assert.equal(payload.targets[0]?.kind, "external");
assert.equal(payload.targets[0]?.approval.externalTargetApproved, true);
assert.equal(payload.targets[0]?.mode, "auto-strict");
assert.equal(payload.settings.maxConcurrentApplications, 20);
assert.equal(payload.settings.computerUseModel, "gpt-5.4-nano");
assert.equal((payload.profile as { workAuth: { citizenshipStatus: string } }).workAuth.citizenshipStatus, "U.S. citizen");

const handsFreeNormalized = normalizeApplyBatchRequest({
  jobs: [jobs[0]!],
  profile,
  mode: "hands-free",
  consent: { externalTargetsApproved: true },
});
assert.equal(handsFreeNormalized.ok, true);
const handsFreePayload = buildRecruit2ApplyPayload(handsFreeNormalized.ok ? handsFreeNormalized.value : (() => {
  throw new Error("hands-free normalization failed");
})());
assert.equal(handsFreePayload.targets[0]?.mode, "autonomous");
assert.equal(handsFreePayload.settings.defaultMode, "autonomous");

const groups = groupDeferredQuestions([
  {
    id: "q1",
    jobId: "job_ai",
    jobTitle: "AI Engineer",
    company: "Acme AI",
    prompt: "What is your main development language?",
    provisionalAnswer: "Python",
    confidence: 0.42,
    category: "primary_programming_language",
    field: { label: "Main development language", selector: "#language" },
  },
  {
    id: "q2",
    jobId: "job_backend",
    jobTitle: "Backend Engineer",
    company: "Beta",
    prompt: "Which programming language are you most fluent in?",
    provisionalAnswer: "TypeScript",
    confidence: 0.38,
    category: "programming_language",
    field: { label: "Most fluent programming language", selector: "#language2" },
  },
  {
    id: "q3",
    jobId: "job_ai",
    jobTitle: "AI Engineer",
    company: "Acme AI",
    prompt: "I certify that this application is accurate.",
    provisionalAnswer: "",
    confidence: 0,
    category: "legal",
    field: { label: "Certification", selector: "#certify" },
  },
]);
assert.equal(groups.length, 2);
assert.equal(groups[0]?.semanticKey, "primary_programming_language");
assert.equal(groups[0]?.items.length, 2);
assert.equal(groups[0]?.requiresExplicitGate, false);
assert.equal(groups[1]?.semanticKey, "legal_certification");
assert.equal(groups[1]?.requiresExplicitGate, true);

const store = createApplyRunStore({
  now: () => 1_800_000_000_000,
  id: () => "run_test",
});
const run = store.createRun(normalized.ok ? normalized.value : (() => {
  throw new Error("normalization failed");
})(), { source: "mock" });
assert.equal(run.id, "run_test");
assert.equal(run.jobs.length, 2);
assert.equal(run.status, "filling");
assert.equal(store.getRun("run_test")?.jobs[0]?.status, "filling");
store.recordDeferredQuestion("run_test", {
  id: "q4",
  jobId: "job_ai",
  jobTitle: "AI Engineer",
  company: "Acme AI",
  prompt: "Main development language?",
  provisionalAnswer: "Python",
  confidence: 0.5,
  category: "primary_programming_language",
  field: { label: "Language" },
});
assert.equal(store.getQuestionGroups("run_test").length, 1);
store.resolveQuestionBatch("run_test", {
  primary_programming_language: {
    answer: "Python",
    remember: true,
  },
});
assert.equal(store.getQuestionGroups("run_test")[0]?.status, "resolved");
store.approveJob("run_test", "job_ai", { devSkipRealSubmit: true });
assert.equal(store.getRun("run_test")?.jobs.find((job) => job.id === "job_ai")?.status, "submitted_dev");

assert.equal(DEFAULT_APPLY_SERVICE_SETTINGS.maxApplicationsPerRun, 20);
assert.equal(DEFAULT_APPLY_SERVICE_SETTINGS.maxConcurrentApplications, 10);
assert.equal(recruit2ApplyApiBaseUrl({ APPLY_LAB_PUBLIC_BASE_URL: "http://localhost:9000" } as unknown as NodeJS.ProcessEnv), "");
assert.equal(recruit2ApplyApiBaseUrl({ NEXT_PUBLIC_APPLY_LAB_PUBLIC_BASE_URL: "http://localhost:9000" } as unknown as NodeJS.ProcessEnv), "");
assert.equal(recruit2ApplyApiBaseUrl({ RECRUIT2_APPLY_API_URL: "http://localhost:9000" } as unknown as NodeJS.ProcessEnv), "");
assert.equal(recruit2ApplyApiBaseUrl({ APPLY_ENGINE_API_URL: "https://apply-engine.example.com/" } as unknown as NodeJS.ProcessEnv), "https://apply-engine.example.com");

console.log("Apply service tests passed");
