export type AgentId = "scout" | "mimi" | "pip" | "juno" | "bodhi";

export type Agent = {
  id: AgentId;
  name: string;
  label: string;
  tagline: string;
  /** Distinct personality color, used for the character's body & features. */
  hue: string;
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
  },
  mimi: {
    id: "mimi",
    name: "Mimi",
    label: "Agent",
    tagline: "Applies to one role at a time, in parallel with the rest.",
    hue: "#DB2777", // pink-600
  },
  pip: {
    id: "pip",
    name: "Pip",
    label: "Agent",
    tagline: "Applies to one role at a time, in parallel with the rest.",
    hue: "#7C3AED", // violet-600
  },
  juno: {
    id: "juno",
    name: "Juno",
    label: "Agent",
    tagline: "Applies to one role at a time, in parallel with the rest.",
    hue: "#D97706", // amber-600
  },
  bodhi: {
    id: "bodhi",
    name: "Bodhi",
    label: "Agent",
    tagline: "Applies to one role at a time, in parallel with the rest.",
    hue: "#059669", // emerald-600
  },
};

export const AGENT_ORDER: AgentId[] = ["scout", "mimi", "pip", "juno", "bodhi"];
