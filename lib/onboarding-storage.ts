export const ONBOARDING_STORAGE_KEY = "recruit:onboarding";

export type OnboardingLinks = {
  github: string;
  linkedin: string;
  twitter: string;
  devpost: string;
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

export function readOnboarding(): OnboardingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return null;
  }
}

export function hasIntake(): boolean {
  const data = readOnboarding();
  return Boolean(data?.intake?.completedAt);
}

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
