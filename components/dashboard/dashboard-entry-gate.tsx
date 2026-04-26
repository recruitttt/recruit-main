"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export const DASHBOARD_LOADING_SESSION_KEY = "recruit:dashboard-loading-seen";

export function markDashboardLoadingSeen() {
  try {
    window.sessionStorage.setItem(DASHBOARD_LOADING_SESSION_KEY, "1");
  } catch {
    // If sessionStorage is unavailable, allow the dashboard rather than looping.
  }
}

export function resetDashboardLoadingSeen() {
  try {
    window.sessionStorage.removeItem(DASHBOARD_LOADING_SESSION_KEY);
  } catch {
    // If sessionStorage is unavailable, the dashboard gate will fall back safely.
  }
}

export function DashboardEntryGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let frame: number | undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      const bypass = params.get("loaded") === "1" || params.get("skipLoading") === "1";
      const seen = window.sessionStorage.getItem(DASHBOARD_LOADING_SESSION_KEY) === "1";

      if (bypass || seen) {
        if (bypass) markDashboardLoadingSeen();
        frame = window.requestAnimationFrame(() => setReady(true));
      } else {
        router.replace("/dashboard/loading");
      }
    } catch {
      frame = window.requestAnimationFrame(() => setReady(true));
    }

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [router]);

  if (!ready) {
    return <main className="min-h-[calc(100dvh-72px)] bg-[var(--dashboard-bg)]" />;
  }

  return <>{children}</>;
}
