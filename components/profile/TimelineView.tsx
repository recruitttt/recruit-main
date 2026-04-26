"use client";

import { useMemo, type ComponentType } from "react";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  GitBranch,
  GraduationCap,
  Medal,
  Newspaper,
  RefreshCw,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { cx, mistClasses } from "@/components/design-system";
import {
  EMPTY_PROFILE,
  type ProfileLogEntry,
  type ProvenanceSource,
  type UserProfile,
} from "@/lib/profile";

type IntakeKind = "github" | "linkedin" | "resume" | "web" | "chat" | "ai-report";

type IntakeRunRow = {
  _id: string;
  status: "queued" | "running" | "completed" | "failed";
  kind: IntakeKind;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

type PublicationLike = {
  title?: string;
  authors?: ReadonlyArray<string>;
  venue?: string;
  date?: string;
  url?: string;
};

type HonorLike = {
  title?: string;
  issuer?: string;
  date?: string;
  description?: string;
};

type CertificationLike = {
  name?: string;
  issuer?: string;
  issueDate?: string;
  expirationDate?: string;
  url?: string;
};

type TimelineProfile = UserProfile & {
  publications?: ReadonlyArray<PublicationLike>;
  honors?: ReadonlyArray<HonorLike>;
  certifications?: ReadonlyArray<CertificationLike>;
};

type UserProfileRow = {
  _id: string;
  userId: string;
  profile?: TimelineProfile;
  provenance?: Record<string, ProvenanceSource>;
  log?: unknown[];
  updatedAt?: string;
};

type RepoSummaryRow = {
  _id: string;
  repoFullName: string;
  generatedAt: string;
  generatedByModel?: string;
  summary?: {
    oneLineDescription?: string;
    whatItDoes?: string;
    keyTechnologies?: ReadonlyArray<string>;
    accomplishments?: ReadonlyArray<string>;
    starQuality?: string;
  };
};

type TimelineTone = "work" | "education" | "project" | "signal" | "system" | "warning";

type TimelineItem = {
  id: string;
  timestamp: number;
  year: string;
  dateLabel: string;
  title: string;
  subtitle?: string;
  detail?: string;
  meta?: string;
  tone: TimelineTone;
  source?: ProvenanceSource | "system";
  icon: ComponentType<{ className?: string }>;
};

export function TimelineView({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const profileRow = useQuery(api.userProfiles.byUser, { userId }) as UserProfileRow | null | undefined;
  const repoRows = useQuery(api.repoSummaries.listByUser, { userId }) as RepoSummaryRow[] | null | undefined;
  const ghRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "github" }) as IntakeRunRow | null | undefined;
  const liRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "linkedin" }) as IntakeRunRow | null | undefined;
  const reRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "resume" }) as IntakeRunRow | null | undefined;
  const webRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "web" }) as IntakeRunRow | null | undefined;
  const chatRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "chat" }) as IntakeRunRow | null | undefined;
  const reportRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "ai-report" }) as IntakeRunRow | null | undefined;

  const profile = profileRow?.profile ?? EMPTY_PROFILE;
  const items = useMemo(
    () => buildTimelineItems({
      profile,
      profileUpdatedAt: profileRow?.updatedAt ?? profile.updatedAt,
      repoRows: repoRows ?? [],
      runs: [ghRun, liRun, reRun, webRun, chatRun, reportRun],
    }),
    [chatRun, ghRun, liRun, profile, profileRow?.updatedAt, reRun, repoRows, reportRun, webRun],
  );

  const grouped = useMemo(() => groupByYear(items), [items]);
  const summary = useMemo(() => summarizeTimeline(items), [items]);
  const loading = profileRow === undefined || repoRows === undefined;

  return (
    <motion.section
      aria-hidden={!active}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0.92, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 pb-16 pt-6 md:px-6"
    >
      <header className={cx("overflow-hidden border px-5 py-5 md:px-6", mistClasses.panel)}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className={mistClasses.sectionLabel}>Profile timeline</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102016] md:text-4xl">
              Chronological profile
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#526854]">
              Roles, education, projects, credentials, intake runs, and profile changes in one ordered view.
            </p>
          </div>
          <TimelineMetrics loading={loading} summary={summary} />
        </div>
      </header>

      <div className="overflow-hidden rounded-[24px] border border-white/45 bg-white/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.46)] backdrop-blur-xl">
        {loading ? (
          <TimelineEmpty title="Loading timeline" detail="Reading profile, repos, and intake runs." />
        ) : grouped.length === 0 ? (
          <TimelineEmpty title="No timeline yet" detail="Add profile sources or connect GitHub and LinkedIn to populate this view." />
        ) : (
          <div className="relative px-4 py-5 md:px-6 md:py-6">
            <div
              className="pointer-events-none absolute bottom-6 left-[112px] top-6 hidden w-px bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(63,122,86,0.24),rgba(255,255,255,0))] md:block"
              aria-hidden="true"
            />
            {grouped.map((group) => (
              <section key={group.year} className="grid gap-3 py-2 md:grid-cols-[92px_minmax(0,1fr)] md:gap-5">
                <div className="md:sticky md:top-[132px] md:self-start">
                  <div className="font-serif text-4xl leading-none text-[#234B32] md:text-5xl">
                    {group.year}
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#738070]">
                    {group.items.length} events
                  </div>
                </div>
                <ol className="relative space-y-1 border-l border-white/65 pl-4 md:border-l-0 md:pl-0">
                  {group.items.map((item, index) => (
                    <TimelineRow key={item.id} item={item} index={index} reduceMotion={Boolean(reduceMotion)} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function TimelineMetrics({
  loading,
  summary,
}: {
  loading: boolean;
  summary: TimelineSummary;
}) {
  const metrics = [
    { label: "Events", value: loading ? "--" : String(summary.total) },
    { label: "Roles", value: loading ? "--" : String(summary.work) },
    { label: "Projects", value: loading ? "--" : String(summary.projects) },
    { label: "Signals", value: loading ? "--" : String(summary.signals) },
  ];

  return (
    <div className="grid min-w-[min(100%,390px)] grid-cols-4 overflow-hidden rounded-lg border border-white/45 bg-white/24">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className={cx("px-3 py-2.5", index > 0 && "border-l border-white/42")}
        >
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#738070]">
            {metric.label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-[#102016]">
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineRow({
  item,
  index,
  reduceMotion,
}: {
  item: TimelineItem;
  index: number;
  reduceMotion: boolean;
}) {
  const Icon = item.icon;
  const tone = toneClasses(item.tone);
  return (
    <motion.li
      layout
      initial={reduceMotion ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.42, delay: Math.min(index, 8) * 0.035 }}
      className="relative"
    >
      <span
        className={cx("absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full border border-white md:-left-[29px]", tone.dot)}
        aria-hidden="true"
      />
      <motion.article
        whileHover={reduceMotion ? undefined : { x: 3 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="grid gap-3 rounded-lg px-2 py-3 transition-colors duration-300 hover:bg-white/28 md:grid-cols-[86px_minmax(0,1fr)]"
      >
        <div className="pt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#738070]">
          {item.dateLabel}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/60", tone.icon)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-[15px] font-semibold text-[#102016]">{item.title}</h2>
                {item.source ? (
                  <span className={cx("font-mono text-[10px] font-semibold uppercase tracking-[0.14em]", tone.source)}>
                    {item.source}
                  </span>
                ) : null}
              </div>
              {item.subtitle ? <p className="mt-0.5 text-sm text-[#526854]">{item.subtitle}</p> : null}
              {item.detail ? <p className="mt-2 text-sm leading-6 text-[#435749]">{item.detail}</p> : null}
              {item.meta ? (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A887B]">
                  {item.meta}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </motion.article>
    </motion.li>
  );
}

function TimelineEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-center">
      <div>
        <Clock3 className="mx-auto h-8 w-8 text-[#6B7C68]" />
        <h2 className="mt-3 text-lg font-semibold text-[#102016]">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#526854]">{detail}</p>
      </div>
    </div>
  );
}

function buildTimelineItems({
  profile,
  profileUpdatedAt,
  repoRows,
  runs,
}: {
  profile: TimelineProfile;
  profileUpdatedAt?: string;
  repoRows: ReadonlyArray<RepoSummaryRow>;
  runs: ReadonlyArray<IntakeRunRow | null | undefined>;
}): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const [index, exp] of (profile.experience ?? []).entries()) {
    const date = timelineDate(exp.endDate, exp.startDate);
    items.push({
      id: `work:${exp.company}:${exp.title}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: exp.title || "Role",
      subtitle: [exp.company, exp.location].filter(Boolean).join(" - "),
      detail: exp.description,
      meta: date.rangeLabel ?? undefined,
      tone: "work",
      source: "linkedin",
      icon: BriefcaseBusiness,
    });
  }

  for (const [index, edu] of (profile.education ?? []).entries()) {
    const date = timelineDate(edu.endDate, edu.startDate);
    items.push({
      id: `education:${edu.school}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: edu.school,
      subtitle: [edu.degree, edu.field].filter(Boolean).join(" - "),
      meta: date.rangeLabel ?? undefined,
      tone: "education",
      source: "linkedin",
      icon: GraduationCap,
    });
  }

  for (const [index, row] of repoRows.entries()) {
    const date = timelineDate(row.generatedAt);
    items.push({
      id: `repo:${row.repoFullName}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: labelForRepo(row.repoFullName),
      subtitle: row.repoFullName,
      detail: row.summary?.oneLineDescription ?? row.summary?.whatItDoes,
      meta: [row.summary?.starQuality, row.generatedByModel].filter(Boolean).join(" - ") || undefined,
      tone: "project",
      source: "github",
      icon: GitBranch,
    });
  }

  for (const [index, pub] of (profile.publications ?? []).entries()) {
    const date = timelineDate(pub.date);
    items.push({
      id: `publication:${pub.title}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: pub.title ?? "Publication",
      subtitle: pub.venue,
      detail: pub.authors?.join(", "),
      tone: "signal",
      source: "linkedin",
      icon: Newspaper,
    });
  }

  for (const [index, honor] of (profile.honors ?? []).entries()) {
    const date = timelineDate(honor.date);
    items.push({
      id: `honor:${honor.title}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: honor.title ?? "Honor",
      subtitle: honor.issuer,
      detail: honor.description,
      tone: "signal",
      source: "linkedin",
      icon: Medal,
    });
  }

  for (const [index, cert] of (profile.certifications ?? []).entries()) {
    const date = timelineDate(cert.issueDate, cert.expirationDate);
    items.push({
      id: `cert:${cert.name}:${index}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: cert.name ?? "Certification",
      subtitle: cert.issuer,
      meta: cert.expirationDate ? `Expires ${cert.expirationDate}` : undefined,
      tone: "signal",
      source: "linkedin",
      icon: BookOpen,
    });
  }

  for (const run of runs) {
    if (!run) continue;
    const date = timelineDate(run.completedAt ?? run.startedAt);
    items.push({
      id: `run:${run.kind}:${run._id}`,
      timestamp: date.timestamp,
      year: date.year,
      dateLabel: date.label,
      title: `${runLabel(run.kind)} intake ${run.status}`,
      subtitle: run.completedAt ? "Completed source sync" : "Started source sync",
      detail: run.error,
      tone: run.status === "failed" ? "warning" : "system",
      source: "system",
      icon: run.status === "failed" ? AlertTriangle : run.status === "completed" ? CheckCircle2 : RefreshCw,
    });
  }

  const profileUpdate = timelineDate(profileUpdatedAt);
  if (profileUpdate.timestamp > 0) {
    items.push({
      id: "profile:updated",
      timestamp: profileUpdate.timestamp,
      year: profileUpdate.year,
      dateLabel: profileUpdate.label,
      title: "Profile updated",
      subtitle: "Canonical profile record",
      detail: latestProfileLog(profile.log),
      tone: "system",
      source: "system",
      icon: Clock3,
    });
  }

  return items
    .filter((item) => item.timestamp > 0)
    .sort((left, right) => right.timestamp - left.timestamp || left.title.localeCompare(right.title));
}

function groupByYear(items: ReadonlyArray<TimelineItem>) {
  const groups: Array<{ year: string; items: TimelineItem[] }> = [];
  for (const item of items) {
    const current = groups.at(-1);
    if (current?.year === item.year) {
      current.items.push(item);
    } else {
      groups.push({ year: item.year, items: [item] });
    }
  }
  return groups;
}

type TimelineSummary = {
  total: number;
  work: number;
  projects: number;
  signals: number;
};

function summarizeTimeline(items: ReadonlyArray<TimelineItem>): TimelineSummary {
  return {
    total: items.length,
    work: items.filter((item) => item.tone === "work").length,
    projects: items.filter((item) => item.tone === "project").length,
    signals: items.filter((item) => item.tone === "signal").length,
  };
}

function timelineDate(primary?: string, fallback?: string) {
  const rangeLabel = [fallback, primary].filter(Boolean).join(" - ");
  const raw = primary && !isPresentDate(primary) ? primary : fallback ?? primary;
  if (!raw) {
    return { timestamp: 0, year: "Unknown", label: "Unknown", rangeLabel };
  }
  if (isPresentDate(raw)) {
    return {
      timestamp: Date.now(),
      year: String(new Date().getFullYear()),
      label: "Now",
      rangeLabel,
    };
  }

  const parsed = parseLooseDate(raw);
  if (!parsed) {
    return { timestamp: 0, year: "Unknown", label: raw, rangeLabel };
  }
  return {
    timestamp: parsed.getTime(),
    year: String(parsed.getFullYear()),
    label: formatTimelineDate(parsed, raw),
    rangeLabel,
  };
}

function parseLooseDate(value: string) {
  const clean = value.trim();
  const yearOnly = clean.match(/^(19|20)\d{2}$/);
  if (yearOnly) return new Date(Number(clean), 0, 1);

  const yearMonth = clean.match(/^((19|20)\d{2})-(\d{1,2})$/);
  if (yearMonth) return new Date(Number(yearMonth[1]), Number(yearMonth[3]) - 1, 1);

  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isPresentDate(value: string) {
  return /^(present|current|now)$/i.test(value.trim());
}

function formatTimelineDate(date: Date, raw: string) {
  if (/^(19|20)\d{2}$/.test(raw.trim())) return String(date.getFullYear());
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function labelForRepo(fullName: string) {
  const slash = fullName.indexOf("/");
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

function runLabel(kind: IntakeKind) {
  const labels: Record<IntakeKind, string> = {
    github: "GitHub",
    linkedin: "LinkedIn",
    resume: "Resume",
    web: "Web",
    chat: "Chat",
    "ai-report": "AI report",
  };
  return labels[kind];
}

function latestProfileLog(log: ReadonlyArray<ProfileLogEntry> | undefined) {
  const latest = log?.at(-1);
  return latest?.label;
}

function toneClasses(tone: TimelineTone) {
  const tones = {
    work: {
      dot: "bg-[#3F7A56] shadow-[0_0_0_3px_rgba(63,122,86,0.16)]",
      icon: "bg-[#E8F4E2]/84 text-[#2F6242]",
      source: "text-[#3F7A56]",
    },
    education: {
      dot: "bg-[#6EA0CA] shadow-[0_0_0_3px_rgba(110,160,202,0.14)]",
      icon: "bg-[#EEF6FB]/86 text-[#386A91]",
      source: "text-[#386A91]",
    },
    project: {
      dot: "bg-[#34A56B] shadow-[0_0_0_3px_rgba(52,165,107,0.14)]",
      icon: "bg-[#E8F7EE]/86 text-[#28774D]",
      source: "text-[#28774D]",
    },
    signal: {
      dot: "bg-[#B86D12] shadow-[0_0_0_3px_rgba(184,109,18,0.13)]",
      icon: "bg-[#FBF1E3]/86 text-[#8A520E]",
      source: "text-[#8A520E]",
    },
    system: {
      dot: "bg-[#6E7B6C] shadow-[0_0_0_3px_rgba(110,123,108,0.12)]",
      icon: "bg-white/64 text-[#526854]",
      source: "text-[#607060]",
    },
    warning: {
      dot: "bg-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.12)]",
      icon: "bg-red-50 text-red-700",
      source: "text-red-700",
    },
  } satisfies Record<TimelineTone, { dot: string; icon: string; source: string }>;
  return tones[tone];
}
