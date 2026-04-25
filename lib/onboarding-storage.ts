// Legacy onboarding-storage helpers. The canonical user profile now lives in
// `lib/profile.ts` (key: "recruit:profile"). New code should use that.
// This file remains so the chat's existing localStorage hydration ("recruit:onboarding")
// keeps working - both stores are written in parallel during onboarding.

import { readProfile } from "@/lib/profile";

export const ONBOARDING_STORAGE_KEY = "recruit:onboarding";

export type OnboardingLinks = {
  github: string;
  linkedin: string;
  twitter: string;
  devpost: string;
  website?: string;
};

export type OnboardingPrefs = {
  roles: string[];
  workAuth: string;
  location: string;
};

export type OnboardingIntake = {
  dreamJob: string;
  lookingFor: string;
  comp: string;
  completedAt: string;
};

export type OnboardingData = {
  name: string;
  email: string;
  resumeFilename: string;
  links: OnboardingLinks;
  prefs: OnboardingPrefs;
  intake?: OnboardingIntake;
};

/** @deprecated Use `readProfile()` from `lib/profile.ts`. Returns a flat shim. */
export function readOnboarding(): OnboardingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OnboardingData;
  } catch {}
  const p = readProfile();
  if (!p.name && !p.email && !p.resume) return null;
  return {
    name: p.name ?? "",
    email: p.email ?? "",
    resumeFilename: p.resume?.filename ?? "",
    links: {
      github: p.links.github ?? "",
      linkedin: p.links.linkedin ?? "",
      twitter: p.links.twitter ?? "",
      devpost: p.links.devpost ?? "",
      website: p.links.website ?? "",
    },
    prefs: {
      roles: p.prefs.roles,
      workAuth: p.prefs.workAuth ?? "",
      location: p.prefs.locations[0] ?? "",
    },
  };
}

/** @deprecated Intake is now part of the profile. */
export function hasIntake(): boolean {
  const data = readOnboarding();
  return Boolean(data?.intake?.completedAt);
}

/** @deprecated Use `mergeProfile()` from `lib/profile.ts`. */
export function saveIntake(intake: OnboardingIntake) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as Partial<OnboardingData>) : {};
    const merged = { ...current, intake };
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify(merged)
    );
  } catch {}
}
