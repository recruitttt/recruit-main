"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { GithubIcon, LinkedinIcon, XIcon, DevpostIcon } from "@/components/ui/brand-icons";
import { Globe, Sparkles } from "lucide-react";
import {
  EMPTY_PROFILE,
  readProfile,
  subscribeProfile,
  SOURCE_HUE,
  SOURCE_LABEL,
  type ProvenanceSource,
  type UserProfile,
} from "@/lib/profile";

const PLACEHOLDER = "·";

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);

  useEffect(() => {
    setProfile(readProfile());
    return subscribeProfile((p) => setProfile(p ?? readProfile()));
  }, []);

  const display = (v?: string) => (v && v.trim() ? v : PLACEHOLDER);
  const enriched = profile.log.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-7">
        <h1 className="font-serif text-[36px] leading-tight tracking-tight text-[var(--color-fg)]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          The intake the agent uses on every application. Edit anything and the agent picks up changes immediately.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            {enriched ? <Pill tone="success">Verified</Pill> : <Pill tone="neutral">Pending</Pill>}
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Full name" value={display(profile.name)} source={profile.provenance.name} />
            <Field label="Email" value={display(profile.email)} source={profile.provenance.email} />
            <Field label="Headline" value={display(profile.headline)} source={profile.provenance.headline} />
            <Field label="Location" value={display(profile.location)} source={profile.provenance.location} />
            {profile.summary && (
              <div className="grid grid-cols-[180px_1fr] gap-4 items-baseline">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono flex items-center gap-2">
                  <ProvenanceDot source={profile.provenance.summary} />
                  Summary
                </div>
                <div className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed">{profile.summary}</div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work authorization</CardTitle>
            <Pill tone="accent">Cached on every app</Pill>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Work auth" value={display(profile.prefs.workAuth)} source={profile.provenance.prefs} />
            <Field label="Earliest start" value={PLACEHOLDER} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <LinkRow icon={GithubIcon} prefix="github.com/" handle={extractHandle(profile.links.github, "github.com/")} source={profile.provenance.github} />
            <LinkRow icon={LinkedinIcon} prefix="linkedin.com/in/" handle={extractHandle(profile.links.linkedin, "linkedin.com/in/")} source={profile.provenance.linkedin} />
            <LinkRow icon={Globe} prefix="" handle={profile.links.website ?? PLACEHOLDER} source={profile.provenance.website} />
            <LinkRow icon={DevpostIcon} prefix="devpost.com/" handle={extractHandle(profile.links.devpost, "devpost.com/")} source={profile.provenance.devpost} />
            <LinkRow icon={XIcon} prefix="x.com/" handle={extractHandle(profile.links.twitter, ["x.com/", "twitter.com/"])} />
          </CardBody>
        </Card>

        {profile.experience.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {profile.experience.map((e, i) => (
                <div key={`${e.company}-${i}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13px] font-medium text-[var(--color-fg)]">{e.title}</div>
                    {(e.startDate || e.endDate) && (
                      <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
                        {e.startDate ?? PLACEHOLDER}{e.endDate ? ` – ${e.endDate}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] font-mono text-[var(--color-fg-muted)]">{e.company}</div>
                  {e.description && (
                    <div className="mt-1.5 text-[12px] text-[var(--color-fg-muted)] leading-relaxed">{e.description}</div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {profile.education.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {profile.education.map((e, i) => (
                <div key={`${e.school}-${i}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5">
                  <div className="text-[13px] font-medium text-[var(--color-fg)]">{e.school}</div>
                  {(e.degree || e.field) && (
                    <div className="text-[12px] font-mono text-[var(--color-fg-muted)]">
                      {[e.degree, e.field].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {profile.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-1 text-[12px] text-[var(--color-fg-muted)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Career preferences</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <PrefRow label="Target roles" items={profile.prefs.roles} />
            <PrefRow label="Locations" items={profile.prefs.locations} />
            {profile.prefs.minSalary && <PrefRow label="Minimum salary" items={[profile.prefs.minSalary]} />}
            {profile.prefs.companySizes && profile.prefs.companySizes.length > 0 && (
              <PrefRow label="Company size" items={profile.prefs.companySizes} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Profile sources
              <span className="text-[var(--color-fg-subtle)] font-mono ml-2 text-[11px]">
                {profile.log.length} event{profile.log.length === 1 ? "" : "s"}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-accent)] font-mono">
              <Sparkles className="h-3 w-3" /> Provenance
            </div>
          </CardHeader>
          <CardBody>
            {profile.log.length === 0 ? (
              <p className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
                Sources will show up here as you complete onboarding.
              </p>
            ) : (
              <div className="space-y-1.5">
                {[...profile.log].reverse().map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className="flex items-center gap-2 text-[12px]">
                    <ProvenanceDot source={entry.source} />
                    <span className="font-mono text-[var(--color-fg-subtle)] w-[80px]">
                      {entry.source}
                    </span>
                    <span className="text-[var(--color-fg-muted)]">{entry.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ProvenanceDot({ source }: { source?: ProvenanceSource }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ backgroundColor: source ? SOURCE_HUE[source] : "var(--color-border-strong)" }}
      title={source ? SOURCE_LABEL[source] : "Not yet captured"}
    />
  );
}

function Field({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: ProvenanceSource;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-baseline">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono flex items-center gap-2">
        <ProvenanceDot source={source} />
        {label}
      </div>
      <div className="text-[14px] text-[var(--color-fg)]">{value}</div>
    </div>
  );
}

function LinkRow({
  icon: Icon,
  prefix,
  handle,
  source,
}: {
  icon: React.ComponentType<{ className?: string }>;
  prefix: string;
  handle: string;
  source?: ProvenanceSource;
}) {
  const empty = handle === PLACEHOLDER;
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5">
      <ProvenanceDot source={source} />
      <Icon className="h-4 w-4 text-[var(--color-accent)]" />
      {prefix && (
        <span className="text-[13px] font-mono text-[var(--color-fg-subtle)]">
          {prefix}
        </span>
      )}
      <span className={`text-[13px] font-mono ${empty ? "text-[var(--color-fg-subtle)]" : "text-[var(--color-fg)]"}`}>
        {handle}
      </span>
    </div>
  );
}

function PrefRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono mb-2">
          {label}
        </div>
        <div className="text-[12px] text-[var(--color-fg-subtle)] font-mono">{PLACEHOLDER}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span
            key={c}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-1 text-[12px] text-[var(--color-fg-muted)]"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function extractHandle(url?: string, prefixes?: string | string[]): string {
  if (!url || !url.trim()) return PLACEHOLDER;
  const trimmed = url.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const list = Array.isArray(prefixes) ? prefixes : prefixes ? [prefixes] : [];
  for (const p of list) {
    if (trimmed.startsWith(p)) return trimmed.slice(p.length);
  }
  return trimmed;
}
