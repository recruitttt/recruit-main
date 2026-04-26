"use client";

//
// RelativeTime — small client component that renders an ISO timestamp as
// a relative phrase ("5 min ago"). Re-renders on a 30s interval so the
// label stays fresh without a full subscription.
//

import { useEffect, useState } from "react";

export interface RelativeTimeProps {
  iso?: string | null;
  /** Fallback text when `iso` is empty / invalid. */
  empty?: string;
  /** ms between re-renders. Default 30s. */
  refreshIntervalMs?: number;
  className?: string;
}

export function RelativeTime({
  iso,
  empty = "never",
  refreshIntervalMs = 30_000,
  className,
}: RelativeTimeProps): React.ReactElement {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setTick((n) => n + 1), refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [iso, refreshIntervalMs]);

  const label = formatRelativeIso(iso, empty);
  const title = iso ?? empty;

  return (
    <time className={className} dateTime={iso ?? undefined} title={title}>
      {label}
    </time>
  );
}

function formatRelativeIso(iso: string | null | undefined, empty: string): string {
  if (!iso) return empty;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return empty;

  const diffSec = Math.round((Date.now() - ts) / 1000);
  const abs = Math.abs(diffSec);
  const future = diffSec < 0;

  if (abs < 5) return "just now";
  if (abs < 60) return future ? `in ${abs}s` : `${abs}s ago`;
  if (abs < 3600) {
    const m = Math.round(abs / 60);
    return future ? `in ${m} min` : `${m} min ago`;
  }
  if (abs < 86_400) {
    const h = Math.round(abs / 3600);
    return future ? `in ${h}h` : `${h}h ago`;
  }
  if (abs < 2_592_000) {
    const d = Math.round(abs / 86_400);
    return future ? `in ${d}d` : `${d}d ago`;
  }
  if (abs < 31_536_000) {
    const mo = Math.round(abs / 2_592_000);
    return future ? `in ${mo}mo` : `${mo}mo ago`;
  }
  const y = Math.round(abs / 31_536_000);
  return future ? `in ${y}y` : `${y}y ago`;
}
