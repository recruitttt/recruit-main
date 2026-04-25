"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Globe, Briefcase, GraduationCap, FileText, Sparkles } from "lucide-react";
import {
  GithubIcon,
  LinkedinIcon,
  XIcon,
  DevpostIcon,
} from "@/components/ui/brand-icons";
import { GlassCard, cx, mistClasses, mistRadii } from "@/components/design-system";
import {
  EMPTY_PROFILE,
  readProfile,
  subscribeProfile,
  SOURCE_HUE,
  SOURCE_LABEL,
  type ProvenanceSource,
} from "@/lib/profile";

export function ProfileCard() {
  const profile = useSyncExternalStore(
    subscribeProfile,
    readProfile,
    () => EMPTY_PROFILE
  );

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
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          <span className={mistClasses.sectionLabel}>
            Building your profile
          </span>
        </div>
        <PulseDot active={hasAnything} />
      </div>

      {!hasAnything && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cx("border border-dashed border-white/60 bg-white/28 px-4 py-8 text-center", mistRadii.nested)}
        >
          <p className="text-[12px] leading-relaxed text-slate-500">
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

          {profile.summary && (
            <Section key="summary" title="Bio">
              <p className="line-clamp-4 text-[12px] leading-relaxed text-slate-600">
                {profile.summary}
              </p>
            </Section>
          )}

          {hasResume && profile.resume && (
            <Section key="resume" title="Resume">
              <div className="flex items-center gap-2 text-[12px] text-slate-600">
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
                    className="rounded-full border border-white/55 bg-white/32 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {s}
                  </motion.span>
                ))}
                {profile.skills.length > 18 && (
                  <span className="self-center font-mono text-[11px] text-slate-500">
                    +{profile.skills.length - 18}
                  </span>
                )}
              </div>
            </Section>
          )}

          {profile.github?.topRepos && profile.github.topRepos.length > 0 && (
            <Section key="github-repos" title="GitHub">
              {profile.github.bio && (
                <p className="mb-1.5 text-[12px] leading-relaxed text-slate-600">
                  {profile.github.bio}
                </p>
              )}
              <div className="space-y-1">
                {profile.github.topRepos.slice(0, 3).map((repo, i) => (
                  <motion.div
                    key={repo.name}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className={cx("bg-white/30 px-2.5 py-1.5", mistRadii.nested)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[12px] text-slate-900">{repo.name}</span>
                      {repo.language && (
                        <span className="rounded-full border border-white/55 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {repo.language}
                        </span>
                      )}
                      {repo.stars != null && repo.stars > 0 && (
                        <span className="ml-auto font-mono text-[10px] text-slate-500">★ {repo.stars}</span>
                      )}
                    </div>
                    {repo.description && (
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">{repo.description}</div>
                    )}
                  </motion.div>
                ))}
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
                    className={cx("flex items-start gap-2 bg-white/30 px-2.5 py-1.5", mistRadii.nested)}
                  >
                    <Briefcase className="mt-1 h-3 w-3 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-slate-900">
                        {e.title}
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        {e.company}
                        {e.startDate && ` · ${e.startDate}${e.endDate ? ` – ${e.endDate}` : ""}`}
                      </div>
                      {e.description && (
                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                          {e.description}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {profile.experience.length > 3 && (
                  <div className="pl-5 font-mono text-[10px] text-slate-500">
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
                    className={cx("flex items-start gap-2 bg-white/30 px-2.5 py-1.5", mistRadii.nested)}
                  >
                    <GraduationCap className="mt-1 h-3 w-3 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-slate-900">
                        {e.school}
                      </div>
                      {(e.degree || e.field) && (
                        <div className="truncate font-mono text-[11px] text-slate-500">
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
                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-600"
                  >
                    {r}
                  </span>
                ))}
              </div>
              {profile.prefs.locations.length > 0 && (
                <div className="mt-1.5 font-mono text-[11px] text-slate-500">
                  {profile.prefs.locations.join(", ")}
                  {profile.prefs.workAuth && ` · ${profile.prefs.workAuth}`}
                </div>
              )}
            </Section>
          )}
        </AnimatePresence>
      </div>

      {profile.log.length > 0 && (
        <div className="mt-5 border-t border-white/45 pt-3">
          <div className={cx("mb-1.5", mistClasses.sectionLabel)}>
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
                <span className="truncate text-slate-600">
                  {entry.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
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
      <div className={cx("mb-1.5", mistClasses.sectionLabel)}>
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
          small ? "text-[11px] text-slate-600" : "text-[13px] text-slate-900",
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
  const hue = source ? SOURCE_HUE[source] : "#6B7A90";
  return (
    <motion.span
      animate={filled ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex h-7 items-center gap-1 rounded-full border px-2"
      style={{
        borderColor: filled ? `${hue}` : "rgba(255,255,255,0.55)",
        backgroundColor: filled ? "rgba(255,255,255,0.36)" : "rgba(248,251,255,0.28)",
        color: filled ? hue : "#6B7A90",
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
        style={{ backgroundColor: active ? "#10B981" : "#6B7A90" }}
      />
    </span>
  );
}
