"use client";

//
// Live "growing profile" hook — subscribes to the Convex userProfile and
// emits a stream of GrowthDelta events as new fields appear. Drives the
// shared-element reveal in <ProfileCard /> and the per-source pulse halo.
//

import { useEffect, useMemo, useReducer, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  diffProfile,
  type FieldPath,
} from "@/lib/onboarding/diff-profile";
import { EMPTY_PROFILE, type ProvenanceSource, type UserProfile } from "@/lib/profile";

export interface GrowthDelta {
  path: FieldPath;
  source: ProvenanceSource;
  appearedAt: number;
  /** True for ~REVEAL_WINDOW_MS after the field first appeared. */
  isNew: boolean;
}

export interface ProfileGrowth {
  profile: UserProfile;
  isLoading: boolean;
  fields: Record<FieldPath, GrowthDelta>;
  /** Newest-first, capped at MAX_RECENT — drives the rail ticker reveal. */
  recent: GrowthDelta[];
}

const REVEAL_WINDOW_MS = 1800;
const MAX_RECENT = 12;

export function useProfileGrowth(userId: string | null): ProfileGrowth {
  const row = useQuery(
    api.userProfiles.byUser,
    userId ? { userId } : "skip",
  );

  const profile = useMemo<UserProfile | null>(() => {
    if (row === undefined) return null; // loading
    if (row === null) return EMPTY_PROFILE;
    if (typeof row === "object" && row !== null && "profile" in row) {
      return ((row as { profile: UserProfile }).profile) ?? EMPTY_PROFILE;
    }
    return EMPTY_PROFILE;
  }, [row]);

  const provenance = useMemo<Record<string, ProvenanceSource>>(() => {
    if (
      row === undefined ||
      row === null ||
      typeof row !== "object" ||
      !("provenance" in row)
    ) {
      return {};
    }
    return ((row as { provenance: Record<string, ProvenanceSource> }).provenance) ?? {};
  }, [row]);

  const previousRef = useRef<UserProfile>(EMPTY_PROFILE);
  const fieldsRef = useRef<Map<FieldPath, GrowthDelta>>(new Map());
  const [, force] = useReducer((n: number) => n + 1, 0);

  // Diff Convex snapshots and stamp newly-arrived fields with isNew=true.
  // setState is intentional here — we're synchronizing with an external store
  // (Convex WS) and then reflecting derived data into render.
  useEffect(() => {
    if (!profile) return;
    const added = diffProfile(previousRef.current, profile);
    if (added.length === 0) {
      previousRef.current = profile;
      return;
    }
    const now = Date.now();
    for (const path of added) {
      const root = path.split(".")[0];
      const source: ProvenanceSource =
        (provenance[path] as ProvenanceSource | undefined) ??
        (provenance[root] as ProvenanceSource | undefined) ??
        "manual";
      fieldsRef.current.set(path, {
        path,
        source,
        appearedAt: now,
        isNew: true,
      });
    }
    previousRef.current = profile;
    // force() is a no-arg reducer dispatch that schedules a re-render so the
    // ref-derived `fields`/`recent` we return below reflect the latest tick.
    force();
  }, [profile, provenance]);

  // Sweep — flip isNew → false after the reveal window.
  useEffect(() => {
    if (fieldsRef.current.size === 0) return;
    const id = window.setTimeout(() => {
      let changed = false;
      const now = Date.now();
      for (const [path, delta] of fieldsRef.current) {
        if (delta.isNew && now - delta.appearedAt >= REVEAL_WINDOW_MS) {
          fieldsRef.current.set(path, { ...delta, isNew: false });
          changed = true;
        }
      }
      if (changed) force();
    }, REVEAL_WINDOW_MS + 50);
    return () => window.clearTimeout(id);
  }, [profile]);

  return useMemo(() => {
    /* eslint-disable react-hooks/refs --
       The ref holds a derivation of the Convex snapshot. The `force()` tick
       in the diff effect is what schedules the re-render that lands us here,
       so reading .current during render correctly reflects the latest value. */
    const map = fieldsRef.current;
    const fields = Object.fromEntries(map);
    const recent = Array.from(map.values())
      .sort((a, b) => b.appearedAt - a.appearedAt)
      .slice(0, MAX_RECENT);
    /* eslint-enable react-hooks/refs */
    return {
      profile: profile ?? EMPTY_PROFILE,
      isLoading: row === undefined,
      fields,
      recent,
    };
  }, [profile, row]);
}
