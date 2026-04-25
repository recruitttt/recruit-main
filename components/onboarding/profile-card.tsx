"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Globe, Briefcase, GraduationCap, FileText, Sparkles } from "lucide-react";
import {
  GithubIcon,
  LinkedinIcon,
  XIcon,
  DevpostIcon,
} from "@/components/ui/brand-icons";
import {
  EMPTY_PROFILE,
  readProfile,
  subscribeProfile,
  SOURCE_HUE,
  SOURCE_LABEL,
  type ProvenanceSource,
  type UserProfile,
} from "@/lib/profile";

export function ProfileCard() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);

  useEffect(() => {
    setProfile(readProfile());
    return subscribeProfile((p) => setProfile(p ?? readProfile()));
  }, []);

  const hasIdentity = Boolean(profile.name || profile.email || profile.headline);
  const hasLinks = Object.values(profile.links).some(Boolean);
  const hasSkills = profile.skills.length > 0;
  const hasExperience = profile.experience.length > 0;
  const hasEducation = profile.education.length > 0;
  const hasResume = Boolean(profile.resume);
  const hasAnything =
    hasIdentity ||
    hasLinks ||
    hasSkills ||
    hasExperience ||
    hasEducation ||
    hasResume;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-subtle)]">
            Building your profile
          </span>
        </div>
        <PulseDot active={hasAnything} />
      </div>

      {!hasAnything && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/50 px-4 py-8 text-center"
        >
          <p className="text-[12px] text-[var(--color-fg-subtle)] leading-relaxed">
            As you chat, your profile fills in here.
            <br />
            The squad will read this when they apply.
          </p>
        </motion.div>
      )}

      <div className="space-y-5">
        <AnimatePresence>
          {hasIdentity && (
            <Section key="identity" title="Identity">
              {profile.name && (
                <FieldRow
                  source={profile.provenance.name}
                  primary={profile.name}
                />
              )}
              {profile.email && (
                <FieldRow
                  source={profile.provenance.email}
                  primary={profile.email}
                  mono
                />
              )}
              {profile.headline && (
                <FieldRow
                  source={profile.provenance.headline}
                  primary={profile.headline}
                  italic
                />
              )}
              {profile.location && (
                <FieldRow
                  source={profile.provenance.location}
                  primary={profile.location}
                  small
                />
              )}
            </Section>
          )}

          {hasLinks && (
            <Section key="links" title="Links">
              <div className="flex flex-wrap gap-1.5">
                <LinkChip
                  href={profile.links.github}
                  Icon={GithubIcon}
                  source={profile.links.github ? profile.provenance.github ?? "chat" : undefined}
                />
                <LinkChip
                  href={profile.links.linkedin}
                  Icon={LinkedinIcon}
                  source={profile.links.linkedin ? profile.provenance.linkedin ?? "chat" : undefined}
                />
                <LinkChip
                  href={profile.links.website}
                  Icon={Globe}
                  source={profile.links.website ? profile.provenance.website ?? "chat" : undefined}
                />
                <LinkChip
                  href={profile.links.devpost}
                  Icon={DevpostIcon}
                  source={profile.links.devpost ? profile.provenance.devpost ?? "chat" : undefined}
                />
                <LinkChip
                  href={profile.links.twitter}
                  Icon={XIcon}
                  source={profile.links.twitter ? "chat" : undefined}
                />
              </div>
            </Section>
          )}

          {hasResume && profile.resume && (
            <Section key="resume" title="Resume">
              <div className="flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
                <FileText className="h-3.5 w-3.5" style={{ color: SOURCE_HUE.resume }} />
                <span className="truncate">{profile.resume.filename}</span>
              </div>
            </Section>
          )}

          {hasSkills && (
            <Section key="skills" title="Skills">
              <div className="flex flex-wrap gap-1">
                {profile.skills.slice(0, 18).map((s, i) => (
                  <motion.span
                    key={s}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.25 }}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-0.5 text-[11px] text-[var(--color-fg-muted)]"
                  >
                    {s}
                  </motion.span>
                ))}
                {profile.skills.length > 18 && (
                  <span className="text-[11px] font-mono text-[var(--color-fg-subtle)] self-center">
                    +{profile.skills.length - 18}
                  </span>
                )}
              </div>
            </Section>
          )}

          {hasExperience && (
            <Section key="experience" title="Experience">
              <div className="space-y-1.5">
                {profile.experience.slice(0, 3).map((e, i) => (
                  <motion.div
                    key={`${e.company}-${e.title}-${i}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className="flex items-start gap-2 rounded-md bg-[var(--color-surface-1)]/60 px-2.5 py-1.5"
                  >
                    <Briefcase className="h-3 w-3 mt-1 text-[var(--color-fg-subtle)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-[var(--color-fg)]">
                        {e.title}
                      </div>
                      <div className="truncate text-[11px] font-mono text-[var(--color-fg-subtle)]">
                        {e.company}
                        {e.startDate && ` · ${e.startDate}${e.endDate ? ` – ${e.endDate}` : ""}`}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {profile.experience.length > 3 && (
                  <div className="pl-5 text-[10px] font-mono text-[var(--color-fg-subtle)]">
                    +{profile.experience.length - 3} more
                  </div>
                )}
              </div>
            </Section>
          )}

          {hasEducation && (
            <Section key="education" title="Education">
              <div className="space-y-1.5">
                {profile.education.slice(0, 2).map((e, i) => (
                  <div
                    key={`${e.school}-${i}`}
                    className="flex items-start gap-2 rounded-md bg-[var(--color-surface-1)]/60 px-2.5 py-1.5"
                  >
                    <GraduationCap className="h-3 w-3 mt-1 text-[var(--color-fg-subtle)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-[var(--color-fg)]">
                        {e.school}
                      </div>
                      {(e.degree || e.field) && (
                        <div className="truncate text-[11px] font-mono text-[var(--color-fg-subtle)]">
                          {[e.degree, e.field].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {profile.prefs.roles.length > 0 && (
            <Section key="prefs" title="Looking for">
              <div className="flex flex-wrap gap-1">
                {profile.prefs.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] text-[var(--color-accent)]"
                  >
                    {r}
                  </span>
                ))}
              </div>
              {profile.prefs.locations.length > 0 && (
                <div className="mt-1.5 text-[11px] font-mono text-[var(--color-fg-subtle)]">
                  {profile.prefs.locations.join(", ")}
                  {profile.prefs.workAuth && ` · ${profile.prefs.workAuth}`}
                </div>
              )}
            </Section>
          )}
        </AnimatePresence>
      </div>

      {profile.log.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-subtle)]">
            Activity
          </div>
          <div className="space-y-0.5">
            {profile.log.slice(-4).reverse().map((entry, i) => (
              <motion.div
                key={`${entry.at}-${i}`}
                initial={{ opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 text-[11px] font-mono"
                style={{ color: SOURCE_HUE[entry.source] }}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                <span className="text-[var(--color-fg-muted)] truncate">
                  {entry.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-subtle)]">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </motion.div>
  );
}

function FieldRow({
  source,
  primary,
  italic = false,
  mono = false,
  small = false,
}: {
  source?: ProvenanceSource;
  primary: string;
  italic?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  const hue = source ? SOURCE_HUE[source] : "transparent";
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hue }}
        title={source ? SOURCE_LABEL[source] : ""}
      />
      <span
        className={[
          "min-w-0 truncate",
          small ? "text-[11px] text-[var(--color-fg-muted)]" : "text-[13px] text-[var(--color-fg)]",
          italic ? "italic" : "",
          mono ? "font-mono text-[12px]" : "",
        ].filter(Boolean).join(" ")}
      >
        {primary}
      </span>
    </div>
  );
}

function LinkChip({
  href,
  Icon,
  source,
}: {
  href?: string;
  Icon: React.ComponentType<{ className?: string }>;
  source?: ProvenanceSource;
}) {
  const filled = Boolean(href);
  const hue = source ? SOURCE_HUE[source] : "var(--color-fg-subtle)";
  return (
    <motion.span
      animate={filled ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex h-7 items-center gap-1 rounded-full border px-2"
      style={{
        borderColor: filled ? `${hue}` : "var(--color-border)",
        backgroundColor: filled ? "var(--color-surface-1)" : "var(--color-surface)",
        color: filled ? hue : "var(--color-fg-subtle)",
        opacity: filled ? 1 : 0.55,
      }}
      title={source ? SOURCE_LABEL[source] : "Not provided"}
    >
      <Icon className="h-3 w-3" />
      {filled && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </motion.span>
  );
}

function PulseDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      {active && (
        <span
          className="absolute inset-0 rounded-full bg-emerald-500/50"
          style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}
        />
      )}
      <span
        className="relative inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? "#10B981" : "var(--color-fg-subtle)" }}
      />
    </span>
  );
}
