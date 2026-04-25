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
  provenance: {},
  log: [],
  updatedAt: new Date(0).toISOString(),
};

const subscribers = new Set<(p: UserProfile) => void>();

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
    return { ...EMPTY_PROFILE, ...parsed };
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

// Merge non-empty values; arrays replace if updater has at least one entry.
function shallowAccept<T>(prev: T | undefined, next: T | undefined): T | undefined {
  if (next === undefined || next === null) return prev;
  if (typeof next === "string" && next.trim() === "") return prev;
  if (Array.isArray(next)) {
    return next.length > 0 ? next : prev;
  }
  return next;
}

export function mergeProfile(
  updates: Partial<UserProfile>,
  source: ProvenanceSource,
  label: string
): UserProfile {
  const current = readProfile();

  const merged: UserProfile = {
    ...current,
    name: shallowAccept(current.name, updates.name),
    email: shallowAccept(current.email, updates.email),
    location: shallowAccept(current.location, updates.location),
    headline: shallowAccept(current.headline, updates.headline),
    summary: shallowAccept(current.summary, updates.summary),
    links: { ...current.links, ...(updates.links ?? {}) },
    resume: updates.resume ? { ...current.resume, ...updates.resume } : current.resume,
    experience:
      updates.experience && updates.experience.length > 0
        ? updates.experience
        : current.experience,
    education:
      updates.education && updates.education.length > 0
        ? updates.education
        : current.education,
    skills:
      updates.skills && updates.skills.length > 0
        ? Array.from(new Set([...current.skills, ...updates.skills])).slice(0, 30)
        : current.skills,
    github: updates.github
      ? {
          ...current.github,
          ...updates.github,
          topRepos:
            updates.github.topRepos && updates.github.topRepos.length > 0
              ? updates.github.topRepos
              : current.github?.topRepos ?? [],
        }
      : current.github,
    prefs: {
      roles:
        updates.prefs?.roles && updates.prefs.roles.length > 0
          ? updates.prefs.roles
          : current.prefs.roles,
      locations:
        updates.prefs?.locations && updates.prefs.locations.length > 0
          ? updates.prefs.locations
          : current.prefs.locations,
      workAuth: shallowAccept(current.prefs.workAuth, updates.prefs?.workAuth),
      minSalary: shallowAccept(current.prefs.minSalary, updates.prefs?.minSalary),
      companySizes:
        updates.prefs?.companySizes && updates.prefs.companySizes.length > 0
          ? updates.prefs.companySizes
          : current.prefs.companySizes,
    },
    provenance: stampProvenance(current.provenance, updates, source),
    log: [
      ...current.log,
      { at: new Date().toISOString(), source, label },
    ].slice(-30),
    updatedAt: new Date().toISOString(),
  };

  writeProfile(merged);
  return merged;
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
  chat: "#0891B2",
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
