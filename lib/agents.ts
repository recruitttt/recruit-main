export type AgentId = "scout" | "mimi" | "pip" | "juno" | "bodhi";

/**
 * Source an agent "owns" during onboarding — drives which character wakes up
 * and reacts when an intake adapter starts emitting patches.
 *   Scout — conductor (no source). Owns the dock/narration.
 *   Mimi  — resume (the personal/identity document).
 *   Pip   — github.
 *   Juno  — linkedin.
 *   Bodhi — web (devpost + personal sites).
 */
export type SourceOwnership = "conductor" | "resume" | "github" | "linkedin" | "web";

export type Agent = {
  id: AgentId;
  name: string;
  label: string;
  tagline: string;
  /** Distinct personality color, used for the character's body & features. */
  hue: string;
  ownsSource: SourceOwnership;
};

/**
 * All 5 agents do the SAME job: source one role, tailor the resume,
 * fill the form, submit, cache the answer. They run in parallel —
 * one agent per application in flight.
 *
 * Names + colors are for personality. Scout speaks during onboarding
 * because she's designated as lead.
 */
export const AGENTS: Record<AgentId, Agent> = {
  scout: {
    id: "scout",
    name: "Scout",
    label: "Agent · lead",
    tagline: "Your lead agent. She speaks for the squad.",
    hue: "#3F7A56",
    ownsSource: "conductor",
  },
  mimi: {
    id: "mimi",
    name: "Mimi",
    label: "Agent · resume",
    tagline: "Reads your resume and grounds every application in real history.",
    hue: "#DB2777", // pink-600
    ownsSource: "resume",
  },
  pip: {
    id: "pip",
    name: "Pip",
    label: "Agent · github",
    tagline: "Pulls your repos, languages, and signal projects.",
    hue: "#7C3AED", // violet-600
    ownsSource: "github",
  },
  juno: {
    id: "juno",
    name: "Juno",
    label: "Agent · linkedin",
    tagline: "Reads your LinkedIn for roles, dates, and recruiter signal.",
    hue: "#D97706", // amber-600
    ownsSource: "linkedin",
  },
  bodhi: {
    id: "bodhi",
    name: "Bodhi",
    label: "Agent · web",
    tagline: "Crawls your personal site and devpost for the rest of the story.",
    hue: "#059669", // emerald-600
    ownsSource: "web",
  },
};

export const AGENT_ORDER: AgentId[] = ["scout", "mimi", "pip", "juno", "bodhi"];

const SOURCE_OWNER_LOOKUP: Record<SourceOwnership, AgentId> = {
  conductor: "scout",
  resume: "mimi",
  github: "pip",
  linkedin: "juno",
  web: "bodhi",
};

export function agentForSource(source: SourceOwnership): AgentId {
  return SOURCE_OWNER_LOOKUP[source];
}

const SOURCE_KIND_TO_OWNERSHIP: Record<string, SourceOwnership> = {
  github: "github",
  linkedin: "linkedin",
  resume: "resume",
  web: "web",
  devpost: "web",
  website: "web",
};

export function agentForSourceKind(kind: string): AgentId | null {
  const ownership = SOURCE_KIND_TO_OWNERSHIP[kind];
  return ownership ? SOURCE_OWNER_LOOKUP[ownership] : null;
}
