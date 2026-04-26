export type Stage =
  | "queued"
  | "tailoring"
  | "reviewing"
  | "submitting"
  | "submitted"
  | "blocked";

export const stageLabels: Record<Stage, string> = {
  queued: "Queued",
  tailoring: "Tailoring",
  reviewing: "Reviewing",
  submitting: "Submitting",
  submitted: "Submitted",
  blocked: "Blocked",
};

export const stageOrder: Stage[] = [
  "queued",
  "tailoring",
  "reviewing",
  "submitting",
  "submitted",
];

export type Application = {
  id: string;
  company: string;
  role: string;
  location: string;
  provider: "Ashby" | "Greenhouse" | "Lever" | "Workday";
  stage: Stage;
  matchScore: number;
  tailoringScore: number;
  startedAt: string;
  lastEventAt: string;
  salaryRange?: string;
  jobUrl: string;
  logoBg: string;
  logoText: string;
};

const MOCK_NOW = "2026-04-25T19:00:00.000Z";
const minutesAgo = (minutes: number) =>
  new Date(Date.parse(MOCK_NOW) - minutes * 60_000).toISOString();
const secondsAgo = (seconds: number) =>
  new Date(Date.parse(MOCK_NOW) - seconds * 1000).toISOString();

export const mockApplications: Application[] = [
  {
    id: "app_anthropic_swe",
    company: "Anthropic",
    role: "Software Engineer, Product",
    location: "San Francisco, CA",
    provider: "Ashby",
    stage: "submitted",
    matchScore: 94,
    tailoringScore: 91,
    startedAt: minutesAgo(18),
    lastEventAt: minutesAgo(4),
    salaryRange: "$210k – $290k",
    jobUrl: "https://jobs.ashbyhq.com/anthropic/swe-product",
    logoBg: "#d97757",
    logoText: "A",
  },
  {
    id: "app_linear_design_eng",
    company: "Linear",
    role: "Design Engineer",
    location: "Remote · Americas",
    provider: "Ashby",
    stage: "submitting",
    matchScore: 89,
    tailoringScore: 87,
    startedAt: minutesAgo(9),
    lastEventAt: secondsAgo(22),
    salaryRange: "$180k – $240k",
    jobUrl: "https://jobs.ashbyhq.com/linear/design-engineer",
    logoBg: "#5e6ad2",
    logoText: "L",
  },
  {
    id: "app_vercel_pe",
    company: "Vercel",
    role: "Product Engineer",
    location: "Remote · Worldwide",
    provider: "Ashby",
    stage: "reviewing",
    matchScore: 92,
    tailoringScore: 88,
    startedAt: minutesAgo(6),
    lastEventAt: secondsAgo(14),
    salaryRange: "$200k – $260k",
    jobUrl: "https://jobs.ashbyhq.com/vercel/product-engineer",
    logoBg: "#000000",
    logoText: "▲",
  },
  {
    id: "app_perplexity_fe",
    company: "Perplexity",
    role: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    provider: "Ashby",
    stage: "tailoring",
    matchScore: 86,
    tailoringScore: 0,
    startedAt: minutesAgo(3),
    lastEventAt: secondsAgo(8),
    salaryRange: "$220k – $300k",
    jobUrl: "https://jobs.ashbyhq.com/perplexity/senior-frontend",
    logoBg: "#1d4944",
    logoText: "P",
  },
  {
    id: "app_supabase_swe",
    company: "Supabase",
    role: "Full Stack Engineer",
    location: "Remote · EMEA / Americas",
    provider: "Ashby",
    stage: "queued",
    matchScore: 84,
    tailoringScore: 0,
    startedAt: minutesAgo(1),
    lastEventAt: secondsAgo(30),
    salaryRange: "$160k – $220k",
    jobUrl: "https://jobs.ashbyhq.com/supabase/fullstack",
    logoBg: "#3ecf8e",
    logoText: "S",
  },
];

export type KPI = {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
};

export const mockKPIs: KPI[] = [
  { label: "Applications submitted", value: "128", delta: "+24 this week", hint: "Lifetime" },
  { label: "Agents running now", value: "3", hint: "Live" },
  { label: "Needs review", value: "4", delta: "−2 from yesterday", hint: "Awaiting your input" },
  { label: "Answer-cache reuses", value: "312", delta: "98.7% hit rate", hint: "Compounding memory" },
  { label: "Provider coverage", value: "100%", hint: "Ashby" },
  { label: "Time saved", value: "23.4h", delta: "≈ 14 min / app", hint: "Estimated" },
];

export type ProviderCoverage = {
  name: "Ashby" | "Greenhouse" | "Lever" | "Workday";
  status: "live" | "preview" | "coming-soon";
  successRate?: number;
};

export const mockProviderCoverage: ProviderCoverage[] = [
  { name: "Ashby", status: "live", successRate: 96 },
  { name: "Greenhouse", status: "coming-soon" },
  { name: "Lever", status: "coming-soon" },
  { name: "Workday", status: "coming-soon" },
];

export type DLQItem = {
  id: string;
  applicationId: string;
  company: string;
  role: string;
  type: "unanswerable_question" | "submission_error";
  question?: string;
  context?: string;
  suggestedAnswer?: string;
  raisedAt: string;
};

export const mockDLQItems: DLQItem[] = [
  {
    id: "dlq_1",
    applicationId: "app_perplexity_fe",
    company: "Perplexity",
    role: "Senior Frontend Engineer",
    type: "unanswerable_question",
    question:
      "Describe a time you migrated a production app from a legacy framework. What was the rollback plan?",
    context:
      "Free-form long-answer field. The agent has no cached answer and the question is too specific to infer from your resume.",
    suggestedAnswer:
      "Draft from your GitHub: the rails-to-next migration on /repos/mo/orbit. Want me to expand?",
    raisedAt: minutesAgo(8),
  },
  {
    id: "dlq_2",
    applicationId: "app_linear_design_eng",
    company: "Linear",
    role: "Design Engineer",
    type: "unanswerable_question",
    question: "What's your expected start date if offered the role?",
    context:
      "Required date field. We never guess sensitive timing facts. Your answer will be cached for every future Ashby application.",
    suggestedAnswer: "Suggest: 4 weeks from offer.",
    raisedAt: minutesAgo(22),
  },
  {
    id: "dlq_3",
    applicationId: "app_anthropic_swe",
    company: "Anthropic",
    role: "Software Engineer, Product",
    type: "unanswerable_question",
    question: "Are you comfortable being on-call once per quarter?",
    context: "Yes/No field. Conservative posture: we never say yes on your behalf.",
    raisedAt: minutesAgo(41),
  },
  {
    id: "dlq_4",
    applicationId: "app_vercel_pe",
    company: "Vercel",
    role: "Product Engineer",
    type: "submission_error",
    context:
      "Browserbase session timed out at the final submit step. Form state is preserved, retry will resume from PreSubmitDiscovery.",
    raisedAt: minutesAgo(64),
  },
];

export type ActivityEvent = {
  id: string;
  applicationId: string;
  company: string;
  text: string;
  timestamp: string;
  kind: "discover" | "tailor" | "review" | "fill" | "submit" | "cache";
};

export const mockActivityFeed: ActivityEvent[] = [
  {
    id: "ev_1",
    applicationId: "app_linear_design_eng",
    company: "Linear",
    text: "Submit-readiness gate passed. Submitting…",
    timestamp: secondsAgo(18),
    kind: "submit",
  },
  {
    id: "ev_2",
    applicationId: "app_vercel_pe",
    company: "Vercel",
    text: "Reused 7 cached answers from prior Ashby runs.",
    timestamp: secondsAgo(34),
    kind: "cache",
  },
  {
    id: "ev_3",
    applicationId: "app_vercel_pe",
    company: "Vercel",
    text: "3-persona review complete. Tailoring score 88.",
    timestamp: secondsAgo(52),
    kind: "review",
  },
  {
    id: "ev_4",
    applicationId: "app_perplexity_fe",
    company: "Perplexity",
    text: "Tailoring resume against JD: emphasizing realtime + perf work.",
    timestamp: secondsAgo(71),
    kind: "tailor",
  },
  {
    id: "ev_5",
    applicationId: "app_supabase_swe",
    company: "Supabase",
    text: "Discovered job at jobs.ashbyhq.com/supabase/fullstack. Queued.",
    timestamp: secondsAgo(95),
    kind: "discover",
  },
  {
    id: "ev_6",
    applicationId: "app_anthropic_swe",
    company: "Anthropic",
    text: "Submission classified as Confirmed. Run grade: A.",
    timestamp: minutesAgo(4),
    kind: "submit",
  },
  {
    id: "ev_7",
    applicationId: "app_linear_design_eng",
    company: "Linear",
    text: "Filled 14 of 14 mapped questions. Verifying values…",
    timestamp: minutesAgo(1),
    kind: "fill",
  },
];

export type Persona = "Hiring Manager" | "Senior Engineer" | "Recruiter";

export type PersonaReview = {
  persona: Persona;
  verdict: "Strong" | "On the line" | "Weak";
  score: number;
  notes: string;
};

export const mockPersonaReviews: PersonaReview[] = [
  {
    persona: "Hiring Manager",
    verdict: "Strong",
    score: 92,
    notes:
      "Resume opens with the metric they care about (DAU growth). Cover letter ties their public eng blog to your Orbit project. Shows real homework.",
  },
  {
    persona: "Senior Engineer",
    verdict: "Strong",
    score: 89,
    notes:
      "TypeScript, Next.js, and Postgres are all top-three signals on their JD. Your migration story is concrete, not buzzword-y.",
  },
  {
    persona: "Recruiter",
    verdict: "On the line",
    score: 84,
    notes:
      "Years-of-experience phrasing is implicit. Recommend explicit '4 years TypeScript' line near the top of the resume.",
  },
];

export type MappedQuestion = {
  id: string;
  label: string;
  canonicalKey: string;
  answer: string;
  source: "resume" | "settings" | "cache" | "model" | "user";
  verified: boolean;
};

export const mockMappedQuestions: MappedQuestion[] = [
  {
    id: "q_1",
    label: "Full name",
    canonicalKey: "name.full",
    answer: "Mo Hoshir",
    source: "settings",
    verified: true,
  },
  {
    id: "q_2",
    label: "Email",
    canonicalKey: "contact.email",
    answer: "mohoshirmo@gmail.com",
    source: "settings",
    verified: true,
  },
  {
    id: "q_3",
    label: "LinkedIn URL",
    canonicalKey: "links.linkedin",
    answer: "linkedin.com/in/mohoshir",
    source: "settings",
    verified: true,
  },
  {
    id: "q_4",
    label: "GitHub URL",
    canonicalKey: "links.github",
    answer: "github.com/mohoshir",
    source: "settings",
    verified: true,
  },
  {
    id: "q_5",
    label: "Are you legally authorized to work in the US?",
    canonicalKey: "work_auth.us_authorized",
    answer: "Yes",
    source: "settings",
    verified: true,
  },
  {
    id: "q_6",
    label: "Will you now or in the future require sponsorship?",
    canonicalKey: "work_auth.sponsorship_required",
    answer: "No",
    source: "settings",
    verified: true,
  },
  {
    id: "q_7",
    label: "Why are you interested in working at Anthropic?",
    canonicalKey: "essay.why_company",
    answer:
      "Anthropic's safety-first framing of capability research mirrors how I think about agent reliability. You build for what happens when the model is wrong, not just when it's right. I want to ship products in that posture.",
    source: "model",
    verified: true,
  },
  {
    id: "q_8",
    label: "Describe your most impactful project.",
    canonicalKey: "essay.impactful_project",
    answer:
      "Orbit, a TypeScript-first agent runtime I built and shipped to 1.2k weekly users. Cut average task latency 47% by replacing ad-hoc tool routing with a typed planner.",
    source: "cache",
    verified: true,
  },
  {
    id: "q_9",
    label: "Pronouns",
    canonicalKey: "demographics.pronouns",
    answer: "he/him",
    source: "settings",
    verified: true,
  },
  {
    id: "q_10",
    label: "How did you hear about us?",
    canonicalKey: "source.referral",
    answer: "Anthropic engineering blog",
    source: "cache",
    verified: true,
  },
];

export type Onboarding5JobMatch = {
  company: string;
  role: string;
  location: string;
  matchScore: number;
  logoBg: string;
  logoText: string;
};

export const onboardingMatches: Onboarding5JobMatch[] = [
  { company: "Anthropic", role: "Software Engineer, Product", location: "San Francisco, CA", matchScore: 94, logoBg: "#d97757", logoText: "A" },
  { company: "Linear", role: "Design Engineer", location: "Remote", matchScore: 89, logoBg: "#5e6ad2", logoText: "L" },
  { company: "Vercel", role: "Product Engineer", location: "Remote", matchScore: 92, logoBg: "#000", logoText: "▲" },
  { company: "Perplexity", role: "Senior Frontend Engineer", location: "San Francisco, CA", matchScore: 86, logoBg: "#1d4944", logoText: "P" },
  { company: "Supabase", role: "Full Stack Engineer", location: "Remote", matchScore: 84, logoBg: "#3ecf8e", logoText: "S" },
];

// Source data for the tailor pipeline. Used while the upstream
// "10 jobs" agent is still under construction. Shape matches the
// Job type in lib/tailor/types.ts.
export const mockTailorJobs = [
  {
    id: "job_anthropic_swe",
    company: "Anthropic",
    role: "Software Engineer, Product",
    location: "San Francisco, CA",
    jobUrl: "https://jobs.ashbyhq.com/anthropic/swe-product",
    logoBg: "#d97757",
    logoText: "A",
  },
  {
    id: "job_linear_design_eng",
    company: "Linear",
    role: "Design Engineer",
    location: "Remote · Americas",
    jobUrl: "https://jobs.ashbyhq.com/linear/design-engineer",
    logoBg: "#5e6ad2",
    logoText: "L",
  },
  {
    id: "job_vercel_pe",
    company: "Vercel",
    role: "Product Engineer",
    location: "Remote · Worldwide",
    jobUrl: "https://jobs.ashbyhq.com/vercel/product-engineer",
    logoBg: "#000000",
    logoText: "▲",
  },
  {
    id: "job_perplexity_fe",
    company: "Perplexity",
    role: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    jobUrl: "https://jobs.ashbyhq.com/perplexity/senior-frontend",
    logoBg: "#1d4944",
    logoText: "P",
  },
  {
    id: "job_supabase_swe",
    company: "Supabase",
    role: "Full Stack Engineer",
    location: "Remote · EMEA / Americas",
    jobUrl: "https://jobs.ashbyhq.com/supabase/fullstack",
    logoBg: "#3ecf8e",
    logoText: "S",
  },
  {
    id: "job_replicate_ml",
    company: "Replicate",
    role: "ML Platform Engineer",
    location: "Remote · Worldwide",
    jobUrl: "https://jobs.ashbyhq.com/replicate/ml-platform",
    logoBg: "#1f1f1f",
    logoText: "R",
  },
  {
    id: "job_modal_se",
    company: "Modal",
    role: "Software Engineer, Infrastructure",
    location: "New York, NY",
    jobUrl: "https://jobs.ashbyhq.com/modal/se-infra",
    logoBg: "#7c3aed",
    logoText: "M",
  },
  {
    id: "job_ramp_fs",
    company: "Ramp",
    role: "Full Stack Engineer",
    location: "New York, NY",
    jobUrl: "https://jobs.ashbyhq.com/ramp/full-stack",
    logoBg: "#ffd03e",
    logoText: "R",
  },
  {
    id: "job_brex_pe",
    company: "Brex",
    role: "Product Engineer",
    location: "San Francisco, CA",
    jobUrl: "https://jobs.ashbyhq.com/brex/product-engineer",
    logoBg: "#f0613a",
    logoText: "B",
  },
  {
    id: "job_railway_se",
    company: "Railway",
    role: "Software Engineer",
    location: "Remote · Worldwide",
    jobUrl: "https://jobs.ashbyhq.com/railway/software-engineer",
    logoBg: "#13111c",
    logoText: "✦",
  },
];
