"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = { userId: string | null };

type ProfileRow = {
  profile?: {
    name?: string;
    headline?: string;
    skills?: string[];
    experience?: Array<{ company: string; title: string }>;
    personalization?: {
      careerGoals?: string;
      valuesAlignment?: string[];
    };
  };
} | null | undefined;

export function ProfileTab({ userId }: Props) {
  const profileDoc = useQuery(
    api.userProfiles.byUser,
    userId ? { userId } : "skip"
  ) as ProfileRow;
  if (!userId)
    return <div className="text-gray-500">Sign in to view your profile.</div>;
  if (profileDoc === undefined)
    return <div className="text-gray-500">Loading…</div>;
  const p = profileDoc?.profile ?? {};

  return (
    <div className="space-y-3">
      <Section label="Name">{p.name ?? "—"}</Section>
      <Section label="Headline">{p.headline ?? "—"}</Section>
      <Section label="Skills">{(p.skills ?? []).join(", ") || "—"}</Section>
      <Section label="Experience">
        <ul className="space-y-1">
          {(p.experience ?? []).map(
            (e: { company: string; title: string }, i: number) => (
              <li key={i}>
                • {e.title} at {e.company}
              </li>
            )
          )}
        </ul>
      </Section>
      <Section label="Personalization">
        {p.personalization ? (
          <ul className="text-xs text-gray-600">
            <li>Goals: {p.personalization.careerGoals ?? "(not set)"}</li>
            <li>
              Values:{" "}
              {(p.personalization.valuesAlignment ?? []).join(", ") ||
                "(not set)"}
            </li>
          </ul>
        ) : (
          <div className="text-xs text-gray-500">
            Chat with the personalization companion to fill this in.
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
