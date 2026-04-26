"use client";

// LocalDataReconciler — invisible component mounted at the root provider.
// Watches the better-auth session and wipes per-user localStorage when the
// signed-in user changes (or signs out) so onboarding state from a previous
// account never leaks into a new one.
//
// See `lib/local-data.ts` for the registry of per-user storage keys.

import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { reconcileLocalDataOwner } from "@/lib/local-data";

export function LocalDataReconciler(): null {
  const session = authClient.useSession();
  const isPending = session.isPending;
  const userId = session.data?.user?.id ?? null;

  useEffect(() => {
    // Skip while the session resolves on first paint — running with a
    // transient `null` would wipe a freshly signed-in user's onboarding
    // chat data before the session loads.
    if (isPending) return;
    reconcileLocalDataOwner(userId);
  }, [isPending, userId]);

  return null;
}
