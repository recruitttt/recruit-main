// Per-browser data scoping — keeps onboarding/profile state from leaking
// between accounts on the same device.
//
// Problem: every onboarding storage write (resume, links, prefs, tailored
// applications, intake-done flag) goes to localStorage. localStorage is
// keyed by ORIGIN, not by signed-in user, so when User A signs out and
// User B signs in on the same browser, User B sees A's resume / chat / prefs
// until they manually clear storage.
//
// Solution: every per-user localStorage key is registered here. We stamp
// the storage with the userId that owns it. On every session change
// (sign-in, sign-out, account swap) we compare the stamp to the current
// userId and wipe everything if they disagree.
//
// IMPORTANT: when adding a new per-user localStorage key anywhere in the
// app, add it to PER_USER_LOCAL_STORAGE_KEYS below.

import { clearOnboardingCookie } from "./onboarding-cookie";

const OWNER_KEY = "recruit:owner";

/** Every localStorage key that holds account-scoped data. */
export const PER_USER_LOCAL_STORAGE_KEYS = [
  "recruit:profile",            // lib/profile.ts (PROFILE_STORAGE_KEY)
  "recruit:onboarding",         // lib/onboarding-storage.ts
  "recruit:tailoredApplications", // lib/tailor/client.ts
  "recruit:intake-done",        // components/room/room-store.ts
] as const;

/** Wipe every per-user storage key + the onboarding gate cookie. */
export function clearLocalUserData(): void {
  if (typeof window === "undefined") return;
  for (const key of PER_USER_LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // localStorage can throw under privacy mode / quota — non-fatal.
    }
  }
  try {
    window.localStorage.removeItem(OWNER_KEY);
  } catch {}
  clearOnboardingCookie();
}

/**
 * Reconcile per-user localStorage with the current session.
 *
 * - `userId === null` (signed out) AND owner stamp present → wipe.
 * - `userId !== null` AND owner stamp differs → wipe, then re-stamp.
 * - `userId !== null` AND owner stamp matches → no-op.
 * - `userId !== null` AND owner stamp absent → stamp (first sign-in on this
 *   browser; trust whatever the user just typed in onboarding).
 */
export function reconcileLocalDataOwner(userId: string | null): void {
  if (typeof window === "undefined") return;
  let owner: string | null = null;
  try {
    owner = window.localStorage.getItem(OWNER_KEY);
  } catch {
    return;
  }

  if (!userId) {
    if (owner) clearLocalUserData();
    return;
  }

  if (owner && owner !== userId) {
    clearLocalUserData();
  }

  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {}
}
