"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GithubIcon, LinkedinIcon, XIcon, DevpostIcon } from "@/components/ui/brand-icons";
import { Check, Globe, Pencil, X } from "lucide-react";
import {
  ActionButton,
  GlassCard,
  Panel,
  StatusBadge,
  cx,
  mistClasses,
  mistColors,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import {
  readProfile,
  mergeProfile,
  subscribeProfile,
  SOURCE_HUE,
  SOURCE_LABEL,
  type ProvenanceSource,
  type UserProfile,
} from "@/lib/profile";

const PLACEHOLDER = "·";

type ProfileDraft = {
  name: string;
  email: string;
  headline: string;
  location: string;
  workAuth: string;
  roles: string;
  locations: string;
  github: string;
  linkedin: string;
  website: string;
  devpost: string;
  twitter: string;
};

function draftFromProfile(profile: UserProfile): ProfileDraft {
  return {
    name: profile.name ?? "",
    email: profile.email ?? "",
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    workAuth: profile.prefs.workAuth ?? "",
    roles: profile.prefs.roles.join(", "),
    locations: profile.prefs.locations.join(", "),
    github: profile.links.github ?? "",
    linkedin: profile.links.linkedin ?? "",
    website: profile.links.website ?? "",
    devpost: profile.links.devpost ?? "",
    twitter: profile.links.twitter ?? "",
  };
}

type SaveFeedback = { kind: "saved" | "error"; text: string };

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(() => readProfile());
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(readProfile()));
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    return subscribeProfile((p) => {
      const next = p ?? readProfile();
      setProfile(next);
      setDraft(draftFromProfile(next));
    });
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 1600);
    return () => clearTimeout(t);
  }, [feedback]);

  const display = (v?: string) => (v && v.trim() ? v : PLACEHOLDER);
  const enriched = Boolean(profile.email || profile.name || profile.prefs.workAuth || profile.prefs.roles.length > 0);
  const setDraftField = (field: keyof ProfileDraft, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const saveDraft = () => {
    try {
      mergeProfile(
        {
          name: draft.name,
          email: draft.email,
          headline: draft.headline,
          location: draft.location,
          links: {
            github: draft.github,
            linkedin: draft.linkedin,
            website: draft.website,
            devpost: draft.devpost,
            twitter: draft.twitter,
          },
          prefs: {
            roles: parseList(draft.roles),
            locations: parseList(draft.locations || draft.location),
            workAuth: draft.workAuth,
          },
        },
        "manual",
        "Edited settings"
      );
      setSaved(true);
      setFeedback({ kind: "saved", text: "Saved ✓" });
      setEditingProfile(false);
    } catch {
      setFeedback({ kind: "error", text: "Couldn’t save" });
    }
  };

  return (
    <main className={cx("min-h-screen overflow-x-hidden px-6 py-6 sm:px-8 md:px-10 md:py-8", mistClasses.page)}>
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

      <div className="relative mx-auto grid min-w-0 max-w-[1480px] gap-5">
        <header className={cx("flex flex-col gap-4 border px-5 py-5 md:flex-row md:items-center md:justify-between", mistClasses.panel)}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={enriched ? "success" : "neutral"}>{enriched ? "verified" : "pending"}</StatusBadge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">Settings</h1>
            <p className="mt-2 max-w-[calc(100vw-4.5rem)] text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] md:max-w-2xl">
              The intake the agent uses on every application. Edit core fields here and the agent picks up changes immediately.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="accent" variant="soft">live read</StatusBadge>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="space-y-5">
            <Panel
              title="Profile"
              description="Core identity used for applications."
              actions={
                <>
                  <StatusBadge tone={enriched ? "success" : "neutral"}>{enriched ? "verified" : "pending"}</StatusBadge>
                  <ActionButton type="button" variant="secondary" size="sm" onClick={() => setEditingProfile(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </ActionButton>
                </>
              }
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
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingProfile ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/26 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            onMouseDown={() => setEditingProfile(false)}
          >
            <motion.div
              className={cx("max-h-[min(760px,calc(100vh-3rem))] w-full max-w-5xl overflow-auto border p-5 shadow-[0_24px_80px_rgba(15,23,42,0.26)]", mistClasses.panel)}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div id="edit-profile-title" className={mistClasses.sectionLabel}>Edit profile</div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Manual edits are saved to this browser profile and used by dashboard tailoring.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {saved ? <StatusBadge tone="success"><Check className="h-3.5 w-3.5" /> saved</StatusBadge> : <StatusBadge tone="neutral">local profile</StatusBadge>}
                  <ActionButton type="button" variant="ghost" size="icon" aria-label="Close edit profile" onClick={() => setEditingProfile(false)}>
                    <X className="h-4 w-4" />
                  </ActionButton>
                </div>
              </div>

              <GlassCard density="compact" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <EditInput label="Full name" value={draft.name} onChange={(value) => setDraftField("name", value)} />
                  <EditInput label="Email" value={draft.email} onChange={(value) => setDraftField("email", value)} />
                  <EditInput label="Headline" value={draft.headline} onChange={(value) => setDraftField("headline", value)} />
                  <EditInput label="Location" value={draft.location} onChange={(value) => setDraftField("location", value)} />
                  <EditInput label="Work auth" value={draft.workAuth} onChange={(value) => setDraftField("workAuth", value)} />
                  <EditInput label="Target roles" value={draft.roles} onChange={(value) => setDraftField("roles", value)} placeholder="Software Engineer, Product Engineer" />
                  <EditInput label="Target locations" value={draft.locations} onChange={(value) => setDraftField("locations", value)} placeholder="Remote, San Francisco" />
                  <EditInput label="Website" value={draft.website} onChange={(value) => setDraftField("website", value)} />
                  <EditInput label="GitHub" value={draft.github} onChange={(value) => setDraftField("github", value)} />
                  <EditInput label="LinkedIn" value={draft.linkedin} onChange={(value) => setDraftField("linkedin", value)} />
                  <EditInput label="DevPost" value={draft.devpost} onChange={(value) => setDraftField("devpost", value)} />
                  <EditInput label="X / Twitter" value={draft.twitter} onChange={(value) => setDraftField("twitter", value)} />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <AnimatePresence>
                    {feedback ? (
                      <motion.span
                        key={feedback.text}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn(
                          "text-xs font-medium leading-none",
                          feedback.kind === "saved" ? "text-emerald-600" : "text-rose-600"
                        )}
                        role="status"
                        aria-live="polite"
                      >
                        {feedback.text}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                  <ActionButton type="button" variant="primary" onClick={saveDraft}>
                    Save changes
                  </ActionButton>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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

function EditInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-[14px] border border-white/55 bg-white/45 px-3 text-sm leading-none text-slate-900 outline-none transition-shadow",
          "placeholder:leading-none placeholder:text-slate-400",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        )}
      />
    </label>
  );
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    <GlassCard
      density="compact"
      interactive
      className="flex flex-wrap items-center gap-3"
    >
      <ProvenanceDot source={source} />
      <Icon className="h-4 w-4 text-[var(--color-accent)]" />
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
