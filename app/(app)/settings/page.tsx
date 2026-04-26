"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { GithubIcon, LinkedinIcon, XIcon, DevpostIcon } from "@/components/ui/brand-icons";
import { Globe, Sparkles } from "lucide-react";
import {
  GlassCard,
  Panel,
  StatusBadge,
  cx,
  mistClasses,
  mistColors,
} from "@/components/design-system";
import {
  readProfile,
  subscribeProfile,
  SOURCE_HUE,
  SOURCE_LABEL,
  type ProvenanceSource,
  type UserProfile,
} from "@/lib/profile";

const PLACEHOLDER = "·";

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(() => readProfile());

  useEffect(() => {
    return subscribeProfile((p) => setProfile(p ?? readProfile()));
  }, []);

  const display = (v?: string) => (v && v.trim() ? v : PLACEHOLDER);
  const enriched = profile.log.length > 0;

  return (
    <main className={cx("min-h-screen overflow-x-hidden px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[7%] top-[10%] h-72 w-72 rounded-full bg-white/30 blur-3xl" />
        <div
          className="absolute right-[7%] top-[18%] h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${mistColors.accent}14` }}
        />
        <div
          className="absolute bottom-[6%] left-[34%] h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${mistColors.neutral}10` }}
        />
      </div>

      <div className="relative mx-auto grid min-w-0 max-w-[1520px] gap-5">
        <header className={cx("flex flex-col gap-4 border px-4 py-4 md:flex-row md:items-center md:justify-between", mistClasses.panel)}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={enriched ? "success" : "neutral"}>{enriched ? "verified" : "pending"}</StatusBadge>
              <StatusBadge tone="accent">{profile.log.length} source{profile.log.length === 1 ? "" : "s"}</StatusBadge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">Settings</h1>
            <p className="mt-2 max-w-[calc(100vw-4.5rem)] text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] md:max-w-2xl">
              The intake the agent uses on every application. Edit anything and the agent picks up changes immediately.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral" variant="soft">profile log</StatusBadge>
            <StatusBadge tone="accent" variant="soft">live read</StatusBadge>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <Panel
              title="Profile"
              description="Core identity used for applications."
              actions={<StatusBadge tone={enriched ? "success" : "neutral"}>{enriched ? "verified" : "pending"}</StatusBadge>}
            >
              <div className="space-y-3">
                <Field label="Full name" value={display(profile.name)} source={profile.provenance.name} />
                <Field label="Email" value={display(profile.email)} source={profile.provenance.email} />
                <Field label="Headline" value={display(profile.headline)} source={profile.provenance.headline} />
                <Field label="Location" value={display(profile.location)} source={profile.provenance.location} />
                {profile.summary && (
                  <GlassCard density="compact" className="flex items-start gap-4">
                    <div className="min-w-[152px] text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-[#465568]">
                      <div className="mb-2 flex items-center gap-2">
                        <ProvenanceDot source={profile.provenance.summary} />
                        Summary
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-sm leading-6 text-slate-700">
                      {profile.summary}
                    </div>
                  </GlassCard>
                )}
              </div>
            </Panel>

            <Panel
              title="Work authorization"
              description="Cached for each app pass."
              actions={<StatusBadge tone="accent">cached on every app</StatusBadge>}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Work auth" value={display(profile.prefs.workAuth)} source={profile.provenance.prefs} />
                <Field label="Earliest start" value={PLACEHOLDER} />
              </div>
            </Panel>

            <Panel title="Links" description="Public profiles the agent can use when tailoring and sourcing.">
              <div className="space-y-2">
                <LinkRow
                  icon={GithubIcon}
                  prefix="github.com/"
                  handle={extractHandle(profile.links.github, "github.com/")}
                  source={profile.provenance.github}
                />
                <LinkRow
                  icon={LinkedinIcon}
                  prefix="linkedin.com/in/"
                  handle={extractHandle(profile.links.linkedin, "linkedin.com/in/")}
                  source={profile.provenance.linkedin}
                />
                <LinkRow
                  icon={Globe}
                  prefix=""
                  handle={profile.links.website ?? PLACEHOLDER}
                  source={profile.provenance.website}
                />
                <LinkRow
                  icon={DevpostIcon}
                  prefix="devpost.com/"
                  handle={extractHandle(profile.links.devpost, "devpost.com/")}
                  source={profile.provenance.devpost}
                />
                <LinkRow
                  icon={XIcon}
                  prefix="x.com/"
                  handle={extractHandle(profile.links.twitter, ["x.com/", "twitter.com/"])}
                />
              </div>
            </Panel>

            <Panel title="Career preferences" description="Role and company filters applied by the agent.">
              <div className="space-y-3">
                <PrefRow label="Target roles" items={profile.prefs.roles} />
                <PrefRow label="Locations" items={profile.prefs.locations} />
                {profile.prefs.minSalary && <PrefRow label="Minimum salary" items={[profile.prefs.minSalary]} />}
                {profile.prefs.companySizes && profile.prefs.companySizes.length > 0 && (
                  <PrefRow label="Company size" items={profile.prefs.companySizes} />
                )}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            {profile.experience.length > 0 && (
              <Panel
                title="Experience"
                description="Positions the agent can reference in tailoring."
                actions={<StatusBadge tone="neutral">{profile.experience.length} role{profile.experience.length === 1 ? "" : "s"}</StatusBadge>}
              >
                <div className="space-y-2">
                  {profile.experience.map((e, i) => (
                    <GlassCard key={`${e.company}-${i}`} density="compact" className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-950">{e.title}</div>
                        {(e.startDate || e.endDate) && (
                          <div className="text-[11px] font-mono text-slate-500">
                            {e.startDate ?? PLACEHOLDER}
                            {e.endDate ? ` – ${e.endDate}` : ""}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-500">{e.company}</div>
                      {e.description && <div className="text-xs leading-6 text-slate-600">{e.description}</div>}
                    </GlassCard>
                  ))}
                </div>
              </Panel>
            )}

            {profile.education.length > 0 && (
              <Panel
                title="Education"
                description="Formal study the agent can surface when relevant."
                actions={<StatusBadge tone="neutral">{profile.education.length} entry{profile.education.length === 1 ? "" : "s"}</StatusBadge>}
              >
                <div className="space-y-2">
                  {profile.education.map((e, i) => (
                    <GlassCard key={`${e.school}-${i}`} density="compact" className="space-y-1.5">
                      <div className="text-sm font-semibold text-slate-950">{e.school}</div>
                      {(e.degree || e.field) && (
                        <div className="text-xs font-mono text-slate-500">
                          {[e.degree, e.field].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </GlassCard>
                  ))}
                </div>
              </Panel>
            )}

            {profile.skills.length > 0 && (
              <Panel
                title="Skills"
                description="Dense skill list used for matching and summaries."
                actions={<StatusBadge tone="neutral">{profile.skills.length} skills</StatusBadge>}
              >
                <GlassCard density="compact">
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-white/55 bg-white/35 px-2.5 py-1 text-[12px] text-slate-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              </Panel>
            )}

            <Panel
              title="Profile sources"
              description="Source and provenance events captured during onboarding."
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge tone={enriched ? "success" : "neutral"}>{profile.log.length} event{profile.log.length === 1 ? "" : "s"}</StatusBadge>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-[#0EA5E9]" />
                    Provenance
                  </span>
                </div>
              }
            >
              {profile.log.length === 0 ? (
                <GlassCard density="compact" className="text-sm leading-6 text-slate-600">
                  Sources will show up here as you complete onboarding.
                </GlassCard>
              ) : (
                <div className="space-y-2">
                  {[...profile.log].reverse().map((entry, i) => (
                    <GlassCard key={`${entry.at}-${i}`} density="compact" className="flex items-center gap-3">
                      <ProvenanceDot source={entry.source} />
                      <span className="w-[84px] shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        {entry.source}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-6 text-slate-700">{entry.label}</span>
                    </GlassCard>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProvenanceDot({ source }: { source?: ProvenanceSource }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ backgroundColor: source ? SOURCE_HUE[source] : mistColors.neutral }}
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
    <GlassCard density="compact" className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-[#465568] sm:w-[152px] sm:shrink-0">
        <div className="flex items-center gap-2">
          <ProvenanceDot source={source} />
          {label}
        </div>
      </div>
      <div className="min-w-0 flex-1 text-sm text-slate-950">{value}</div>
    </GlassCard>
  );
}

function LinkRow({
  icon: Icon,
  prefix,
  handle,
  source,
}: {
  icon: ComponentType<{ className?: string }>;
  prefix: string;
  handle: string;
  source?: ProvenanceSource;
}) {
  const empty = handle === PLACEHOLDER;
  return (
    <GlassCard density="compact" className="flex flex-wrap items-center gap-3">
      <ProvenanceDot source={source} />
      <Icon className="h-4 w-4 text-[#0EA5E9]" />
      {prefix && (
        <span className="text-[13px] font-mono text-slate-500">{prefix}</span>
      )}
      <span className={cx("min-w-0 text-[13px] font-mono", empty ? "text-slate-500" : "text-slate-900")}>
        {handle}
      </span>
    </GlassCard>
  );
}

function PrefRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <GlassCard density="compact" className="space-y-2">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-[#465568]">
          {label}
        </div>
        <div className="font-mono text-[12px] text-slate-500">{PLACEHOLDER}</div>
      </GlassCard>
    );
  }
  return (
    <GlassCard density="compact" className="space-y-2">
      <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-[#465568]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span
            key={c}
            className="rounded-md border border-white/55 bg-white/35 px-2.5 py-1 text-[12px] text-slate-600"
          >
            {c}
          </span>
        ))}
      </div>
    </GlassCard>
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
