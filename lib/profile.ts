// Single source of truth for the user's profile.
// Populated as the user chats during onboarding, enriched by scrapers,
// read by the live profile card and /settings, and intended to be the
// canonical handoff for downstream agents.

export const PROFILE_STORAGE_KEY = "recruit:profile";

export type ProvenanceSource =
  | "chat"
  | "resume"
  | "github"
  | "linkedin"
  | "website"
  | "devpost"
  | "manual";

export type WorkExperience = {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: string;
};

export type Education = {
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
};

export type GitHubRepo = {
  name: string;
  description?: string;
  language?: string;
  stars?: number;
  url: string;
};

export type ProfileLinks = {
  github?: string;
  linkedin?: string;
  twitter?: string;
  devpost?: string;
  website?: string;
};

export type ProfilePrefs = {
  roles: string[];
  workAuth?: string;
  locations: string[];
  minSalary?: string;
  companySizes?: string[];
};

export type Personalization = {
  careerGoals?: string;
  workEnvironment?: {
    remote?: boolean;
    teamSize?: string;
    pace?: string;
  };
  motivations?: string[];
  communicationStyle?: string;
  valuesAlignment?: string[];
  storyFragments?: Array<{
    topic: string;
    story: string;
    updatedAt: string;
  }>;
  lastInteractionAt?: string;
};

export type ResumeRecord = {
  filename: string;
  rawText?: string;
  uploadedAt: string;
};

export type GitHubEnrichment = {
  username?: string;
  bio?: string;
  company?: string;
  publicRepos?: number;
  followers?: number;
  topRepos: GitHubRepo[];
};

export type ProfileLogEntry = {
  at: string;
  source: ProvenanceSource;
  label: string;
  level?: "info" | "success" | "warning" | "error";
  payload?: unknown;
};

export type ProfileSuggestion = {
  id: string;
  field: string;
  currentValue?: unknown;
  suggestedValue: unknown;
  source: ProvenanceSource;
  label: string;
  createdAt: string;
  status: "pending" | "accepted" | "dismissed";
};

export type UserProfile = {
  name?: string;
  email?: string;
  location?: string;
  headline?: string;
  summary?: string;
  links: ProfileLinks;
  resume?: ResumeRecord;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  github?: GitHubEnrichment;
  prefs: ProfilePrefs;
  personalization?: Personalization;
  suggestions: ProfileSuggestion[];
  provenance: Record<string, ProvenanceSource>;
  log: ProfileLogEntry[];
  updatedAt: string;
};

export const EMPTY_PROFILE: UserProfile = {
  links: {},
  experience: [],
  education: [],
  skills: [],
  prefs: { roles: [], locations: [] },
  suggestions: [],
  provenance: {},
  log: [],
  updatedAt: new Date(0).toISOString(),
};

const subscribers = new Set<(p: UserProfile) => void>();
const ENRICHMENT_SOURCES = new Set<ProvenanceSource>(["github", "linkedin", "website", "devpost"]);
const SUGGEST_ONLY_FIELDS = ["name", "location", "headline", "summary", "experience", "education", "skills"] as const;

// Cached snapshot. Required for useSyncExternalStore's getSnapshot, which
// must return a stable reference between renders or React loops forever.
let cached: UserProfile | null = null;
let hydrated = false;

function hydrate(): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...EMPTY_PROFILE,
      ...parsed,
      links: { ...EMPTY_PROFILE.links, ...(parsed.links ?? {}) },
      experience: parsed.experience ?? [],
      education: parsed.education ?? [],
      skills: parsed.skills ?? [],
      prefs: { ...EMPTY_PROFILE.prefs, ...(parsed.prefs ?? {}) },
      suggestions: parsed.suggestions ?? [],
      provenance: parsed.provenance ?? {},
      log: parsed.log ?? [],
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function readProfile(): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  if (!hydrated) {
    cached = hydrate();
    hydrated = true;
  }
  return cached!;
}

export function writeProfile(p: UserProfile): void {
  cached = p;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
  } catch {}
  // Dispatch async so callers triggering merge during a render don't
  // synchronously update other React subscribers.
  setTimeout(() => {
    subscribers.forEach((cb) => {
      try {
        cb(p);
      } catch {}
    });
  }, 0);
}

// Stamp every top-level key touched by `updates` with the source.
function stampProvenance(
  current: Record<string, ProvenanceSource>,
  updates: Partial<UserProfile>,
  source: ProvenanceSource
): Record<string, ProvenanceSource> {
  const next = { ...current };
  for (const key of Object.keys(updates)) {
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
    next[key] = source;
  }
  return next;
}

function appendLog(
  current: ProfileLogEntry[],
  source: ProvenanceSource,
  label: string,
  level: ProfileLogEntry["level"] = "success",
  payload?: unknown
): ProfileLogEntry[] {
  return [
    ...current,
    { at: new Date().toISOString(), source, label, level, ...(payload === undefined ? {} : { payload }) },
  ].slice(-80);
}

// Merge non-empty values; arrays replace if updater has at least one entry.
function shallowAccept<T>(prev: T | undefined, next: T | undefined): T | undefined {
  if (next === undefined || next === null) return prev;
  if (typeof next === "string" && next.trim() === "") return prev;
  if (Array.isArray(next)) {
    return next.length > 0 ? next : prev;
  }
  return next;
}

function hasUsableValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function suggestionId(source: ProvenanceSource, field: string, value: unknown): string {
  let encoded = "";
  try {
    encoded = JSON.stringify(value);
  } catch {
    encoded = String(value);
  }
  return `${source}:${field}:${encoded.slice(0, 180)}`;
}

function collectEnrichmentSuggestions(
  current: UserProfile,
  updates: Partial<UserProfile>,
  source: ProvenanceSource
): ProfileSuggestion[] {
  if (!ENRICHMENT_SOURCES.has(source)) return [];
  const createdAt = new Date().toISOString();
  return SUGGEST_ONLY_FIELDS.flatMap((field) => {
    const suggestedValue = updates[field];
    if (!hasUsableValue(suggestedValue)) return [];
    return [{
      id: suggestionId(source, field, suggestedValue),
      field,
      currentValue: current[field],
      suggestedValue,
      source,
      label: `${SOURCE_LABEL[source]} suggested ${field}`,
      createdAt,
      status: "pending" as const,
    }];
  });
}

function mergeSuggestions(current: ProfileSuggestion[], incoming: ProfileSuggestion[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) if (!byId.has(item.id)) byId.set(item.id, item);
  return Array.from(byId.values()).slice(-80);
}

function omitSuggestOnlyFields(updates: Partial<UserProfile>): Partial<UserProfile> {
  const next = { ...updates };
  for (const field of SUGGEST_ONLY_FIELDS) delete next[field];
  return next;
}

export function mergeProfile(
  updates: Partial<UserProfile>,
  source: ProvenanceSource,
  label: string
): UserProfile {
  const current = readProfile();
  const suggestions = collectEnrichmentSuggestions(current, updates, source);
  const acceptedUpdates = ENRICHMENT_SOURCES.has(source) ? omitSuggestOnlyFields(updates) : updates;

  const merged: UserProfile = {
    ...current,
    name: shallowAccept(current.name, acceptedUpdates.name),
    email: shallowAccept(current.email, acceptedUpdates.email),
    location: shallowAccept(current.location, acceptedUpdates.location),
    headline: shallowAccept(current.headline, acceptedUpdates.headline),
    summary: shallowAccept(current.summary, acceptedUpdates.summary),
    links: { ...current.links, ...(acceptedUpdates.links ?? {}) },
    resume: acceptedUpdates.resume ? { ...current.resume, ...acceptedUpdates.resume } : current.resume,
    experience:
      acceptedUpdates.experience && acceptedUpdates.experience.length > 0
        ? acceptedUpdates.experience
        : current.experience,
    education:
      acceptedUpdates.education && acceptedUpdates.education.length > 0
        ? acceptedUpdates.education
        : current.education,
    skills:
      acceptedUpdates.skills && acceptedUpdates.skills.length > 0
        ? Array.from(new Set([...current.skills, ...acceptedUpdates.skills])).slice(0, 30)
        : current.skills,
    github: acceptedUpdates.github
      ? {
          ...current.github,
          ...acceptedUpdates.github,
          topRepos:
            acceptedUpdates.github.topRepos && acceptedUpdates.github.topRepos.length > 0
              ? acceptedUpdates.github.topRepos
              : current.github?.topRepos ?? [],
        }
      : current.github,
    prefs: {
      roles:
        acceptedUpdates.prefs?.roles && acceptedUpdates.prefs.roles.length > 0
          ? acceptedUpdates.prefs.roles
          : current.prefs.roles,
      locations:
        acceptedUpdates.prefs?.locations && acceptedUpdates.prefs.locations.length > 0
          ? acceptedUpdates.prefs.locations
          : current.prefs.locations,
      workAuth: shallowAccept(current.prefs.workAuth, acceptedUpdates.prefs?.workAuth),
      minSalary: shallowAccept(current.prefs.minSalary, acceptedUpdates.prefs?.minSalary),
      companySizes:
        acceptedUpdates.prefs?.companySizes && acceptedUpdates.prefs.companySizes.length > 0
          ? acceptedUpdates.prefs.companySizes
          : current.prefs.companySizes,
    },
    suggestions: mergeSuggestions(current.suggestions, suggestions),
    provenance: stampProvenance(current.provenance, acceptedUpdates, source),
    log: appendLog(
      current.log,
      source,
      label,
      suggestions.length > 0 ? "warning" : "success",
      suggestions.length > 0 ? { suggestionsStored: suggestions.length, mode: "suggest_only" } : undefined
    ),
    updatedAt: new Date().toISOString(),
  };

  writeProfile(merged);
  return merged;
}

export function logProfileEvent(
  source: ProvenanceSource,
  label: string,
  level: ProfileLogEntry["level"] = "info",
  payload?: unknown
): UserProfile {
  const current = readProfile();
  const next = { ...current, log: appendLog(current.log, source, label, level, payload), updatedAt: new Date().toISOString() };
  writeProfile(next);
  return next;
}

// Compatible with both `(p) => void` listeners and React's
// `useSyncExternalStore` which passes a `() => void` notifier.
export function subscribeProfile(cb: (p?: UserProfile) => void): () => void {
  subscribers.add(cb as (p: UserProfile) => void);
  return () => {
    subscribers.delete(cb as (p: UserProfile) => void);
  };
}

export function clearProfile(): void {
  cached = EMPTY_PROFILE;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {}
  setTimeout(() => {
    subscribers.forEach((cb) => {
      try {
        cb(EMPTY_PROFILE);
      } catch {}
    });
  }, 0);
}

// Hue mapping per source (matches lib/agents.ts colors).
export const SOURCE_HUE: Record<ProvenanceSource, string> = {
  chat: "#3F7A56",
  resume: "#DB2777",
  github: "#7C3AED",
  linkedin: "#059669",
  website: "#D97706",
  devpost: "#7C3AED",
  manual: "#585861",
};

export const SOURCE_LABEL: Record<ProvenanceSource, string> = {
  chat: "From your chat",
  resume: "From your resume",
  github: "From your GitHub",
  linkedin: "From your LinkedIn",
  website: "From your website",
  devpost: "From your DevPost",
  manual: "Edited manually",
};
