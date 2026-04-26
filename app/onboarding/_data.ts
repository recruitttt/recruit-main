// Onboarding types + constants extracted from page.tsx so the step cards,
// hooks, and orchestrator can share them without circular imports.

export type Step = "account" | "resume" | "connect" | "prefs" | "activate";

export const STEP_ORDER: Step[] = [
  "account",
  "resume",
  "connect",
  "prefs",
  "activate",
];

export const STEP_INDEX: Record<Step, number> = {
  account: 0,
  resume: 1,
  connect: 2,
  prefs: 3,
  activate: 4,
};

export const STEP_LABEL: Record<Step, string> = {
  account: "Account",
  resume: "Resume",
  connect: "Connect",
  prefs: "Preferences",
  activate: "Activate",
};

export const STEP_PROMPTS: Record<Step, string> = {
  account: "Sign in to start. GitHub gets you the richest profile fastest.",
  resume:
    "Upload your resume so I can ground every application in real history.",
  connect:
    "Link any other sources. Background pulls fire instantly so you can keep moving.",
  prefs:
    "Last bit. Any roles, locations, or work-auth constraints I should respect?",
  activate:
    "Everything queued. Confirm and I'll open the Ready Room while sources finish.",
};

export type IntakeKind = "github" | "linkedin" | "resume" | "web" | "ai-report";

export const SOURCE_NAME: Record<IntakeKind, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  resume: "Resume",
  web: "Web",
  "ai-report": "AI report",
};

export const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

export const AUTH_OPTIONS = [
  "US citizen",
  "US permanent resident",
  "Need sponsorship",
];

export interface Data {
  name: string;
  email: string;
  resumeFilename: string;
  resumeStorageId: string | null;
  links: {
    github: string;
    linkedin: string;
    twitter: string;
    devpost: string;
    website: string;
  };
  prefs: { roles: string[]; workAuth: string; location: string };
}

export type DataUpdate = Partial<Omit<Data, "links" | "prefs">> & {
  links?: Partial<Data["links"]>;
  prefs?: Partial<Data["prefs"]>;
};

export const EMPTY: Data = {
  name: "",
  email: "",
  resumeFilename: "",
  resumeStorageId: null,
  links: { github: "", linkedin: "", twitter: "", devpost: "", website: "" },
  prefs: { roles: [], workAuth: "", location: "" },
};

// localStorage key the chat sidebar's hydration code reads from
// (lib/onboarding-storage.ts). Kept stable for back-compat with e2e tests
// that seed this key directly. Phase 2 may relocate canonical state to
// Convex while keeping this as an offline mirror.
export const STORAGE = "recruit:onboarding";

export type ChatEntry =
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "user"; text: string };

export type LaunchStage = "idle" | "starting" | "error";

export const TESTIMONIAL = {
  quote:
    "I'd pay 10% of my yearly expected income for this. 10% of $2 million—$200k.",
  author: "Victor Cheng",
  meta: "YC F24",
} as const;

export type IntakeRunRow =
  | {
      status: "queued" | "running" | "completed" | "failed";
      events?: Array<{
        stage?: string;
        message?: string;
        done?: number;
        total?: number;
        level?: string;
      }>;
      startedAt?: string;
      completedAt?: string;
      error?: string;
    }
  | null
  | undefined;

export function resolveStartingStep(stepParam: string | null): Step {
  if (!stepParam) return "account";
  const numeric = Number.parseInt(stepParam, 10);
  if (
    Number.isFinite(numeric) &&
    numeric >= 1 &&
    numeric <= STEP_ORDER.length
  ) {
    return STEP_ORDER[numeric - 1];
  }
  if ((STEP_ORDER as string[]).includes(stepParam)) return stepParam as Step;
  return "account";
}
