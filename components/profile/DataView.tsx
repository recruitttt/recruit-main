"use client";

//
// DataView — dense sectioned dashboard view of the canonical UserProfile.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §9.1
//
// Subscribes to:
//   - api.userProfiles.byUser   → canonical UserProfile blob + provenance map
//   - api.intakeRuns.byUserKind → last-synced badges per source (github,
//                                  linkedin, resume, web, chat, ai-report)
//   - api.repoSummaries.listByUser → rich GitHub project panels with
//                                     `whatItDoes`, `metadataSummary`, and
//                                     `notableImplementationDetails`.
//
// Real-time updates ride Convex `useQuery` subscriptions — no polling.
//

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitCommit,
  GraduationCap,
  Heart,
  Languages,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Medal,
  Newspaper,
  Sparkles,
  Star,
  User2,
  Wrench,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import {
  cx,
  StatusBadge,
  mistClasses,
} from "@/components/design-system";
import {
  EMPTY_PROFILE,
  type ProvenanceSource,
  type UserProfile,
  type WorkExperience,
  type Education,
  type GitHubRepo,
} from "@/lib/profile";
import { ProvenancePill, ProvenanceLegend } from "./ProvenancePill";
import { SectionCard } from "./SectionCard";
import { RelativeTime } from "./RelativeTime";
import { Markdown } from "./Markdown";
import {
  getSourceConnectionStatus,
  isGithubConnected,
  type SourceConnectionStatus,
} from "@/lib/intake/shared/source-state";

// ---------------------------------------------------------------------------
// Server query result shapes — `useQuery` returns `undefined` while loading.
// We treat them as flexible blobs since the Convex handlers return `v.any()`.
// ---------------------------------------------------------------------------

type IntakeKind = "github" | "linkedin" | "resume" | "web" | "chat" | "ai-report";

interface IntakeRunRow {
  _id: string;
  status: "queued" | "running" | "completed" | "failed";
  kind: IntakeKind;
  events?: unknown[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface UserProfileRow {
  _id: string;
  userId: string;
  profile?: UserProfile & {
    // Optional richer fields the LinkedIn/Resume mappers may inject —
    // canonical UserProfile shape doesn't declare them but the merge is
    // schemaless so they can land in the blob.
    publications?: ReadonlyArray<PublicationLike>;
    honors?: ReadonlyArray<HonorLike>;
    certifications?: ReadonlyArray<CertificationLike>;
    spokenLanguages?: ReadonlyArray<LanguageLike>;
    interests?: ReadonlyArray<InterestLike>;
  };
  provenance?: Record<string, ProvenanceSource>;
  log?: unknown[];
  updatedAt?: string;
}

interface ConnectedAccountsRow {
  github: {
    linked: boolean;
    hasAccessToken: boolean;
    accountId?: string;
  };
}

interface RepoSummaryRow {
  _id: string;
  userId: string;
  repoFullName: string;
  sourceContentHash: string;
  generatedByModel: string;
  generatedAt: string;
  summary: RepoSummaryFields;
}

interface RepoSummaryFields {
  oneLineDescription?: string;
  whatItDoes?: string;
  metadataSummary?: string;
  keyTechnologies?: ReadonlyArray<string>;
  userContributions?: string;
  accomplishments?: ReadonlyArray<string>;
  difficulty?: string;
  starQuality?: string;
  notableImplementationDetails?: ReadonlyArray<string>;
  exploredFiles?: ReadonlyArray<string>;
}

interface PublicationLike {
  title?: string;
  authors?: ReadonlyArray<string>;
  venue?: string;
  date?: string;
  url?: string;
  citation?: string;
}
interface HonorLike {
  title?: string;
  issuer?: string;
  date?: string;
  description?: string;
}
interface CertificationLike {
  name?: string;
  issuer?: string;
  issueDate?: string;
  expirationDate?: string;
  url?: string;
}
interface LanguageLike {
  language?: string;
  proficiency?: string;
}
interface InterestLike {
  name?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface DataViewProps {
  userId: string;
  /** Optional fallback display values from the better-auth session. */
  fallbackName?: string;
  fallbackEmail?: string;
  fallbackImage?: string;
}

export function DataView({
  userId,
  fallbackName,
  fallbackEmail,
  fallbackImage,
}: DataViewProps): React.ReactElement {
  // Canonical profile doc (real-time).
  const profileRow = useQuery(api.userProfiles.byUser, { userId }) as
    | UserProfileRow
    | null
    | undefined;

  // Last-synced metadata per source — one subscription per kind.
  const ghRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "github" }) as
    | IntakeRunRow
    | null
    | undefined;
  const liRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "linkedin" }) as
    | IntakeRunRow
    | null
    | undefined;
  const reRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "resume" }) as
    | IntakeRunRow
    | null
    | undefined;
  const webRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "web" }) as
    | IntakeRunRow
    | null
    | undefined;
  const chatRun = useQuery(api.intakeRuns.byUserKind, { userId, kind: "chat" }) as
    | IntakeRunRow
    | null
    | undefined;
  const reportRun = useQuery(api.intakeRuns.byUserKind, {
    userId,
    kind: "ai-report",
  }) as IntakeRunRow | null | undefined;
  const accountConnections = useQuery(api.auth.connectedAccounts, { userId }) as
    | ConnectedAccountsRow
    | undefined;

  // Rich GitHub repo summaries (used in the Projects section).
  const repoSummaries = useQuery(api.repoSummaries.listByUser, { userId }) as
    | ReadonlyArray<RepoSummaryRow>
    | null
    | undefined;

  const profile: UserProfileRow["profile"] = profileRow?.profile ?? EMPTY_PROFILE;
  const provenance: Record<string, ProvenanceSource> = profileRow?.provenance ?? {};

  const runs: Record<IntakeKind, IntakeRunRow | null | undefined> = useMemo(
    () => ({
      github: ghRun,
      linkedin: liRun,
      resume: reRun,
      web: webRun,
      chat: chatRun,
      "ai-report": reportRun,
    }),
    [ghRun, liRun, reRun, webRun, chatRun, reportRun],
  );

  const loading = profileRow === undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 pb-16 pt-6 md:px-6">
      {loading ? <LoadingBanner /> : null}

      <HeaderCard
        profile={profile}
        provenance={provenance}
        runs={runs}
        accountConnections={accountConnections}
        profileLoading={loading}
        fallbackName={fallbackName}
        fallbackEmail={fallbackEmail}
        fallbackImage={fallbackImage}
      />

      <IdentitySection profile={profile} provenance={provenance} />

      <ExperienceSection
        profile={profile}
        provenance={provenance}
        ghRun={ghRun}
      />

      <EducationSection profile={profile} provenance={provenance} />

      <ProjectsSection
        profile={profile}
        provenance={provenance}
        repoSummaries={repoSummaries ?? []}
        repoSummariesLoading={repoSummaries === undefined}
      />

      <SkillsSection profile={profile} provenance={provenance} />

      <ExtrasSection profile={profile} provenance={provenance} />

      <DebugFooter
        profileRow={profileRow}
        repoSummaryCount={repoSummaries?.length ?? 0}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header card
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<IntakeKind, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  resume: "Resume",
  web: "Web",
  chat: "Chat",
  "ai-report": "AI report",
};

function HeaderCard({
  profile,
  provenance,
  runs,
  accountConnections,
  profileLoading,
  fallbackName,
  fallbackEmail,
  fallbackImage,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
  runs: Record<IntakeKind, IntakeRunRow | null | undefined>;
  accountConnections: ConnectedAccountsRow | undefined;
  profileLoading: boolean;
  fallbackName?: string;
  fallbackEmail?: string;
  fallbackImage?: string;
}): React.ReactElement {
  const name = profile.name?.trim() || fallbackName || "Unnamed user";
  const email = profile.email || fallbackEmail || "";
  const headline = profile.headline?.trim() || "";
  const location = profile.location?.trim() || "";
  const avatar = fallbackImage || "";

  return (
    <section
      className={cx(
        "relative overflow-hidden border p-5 md:p-6",
        mistClasses.panel,
      )}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <Avatar name={name} src={avatar} size={84} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h1 className="truncate font-serif text-[34px] leading-[1.05] tracking-tight text-slate-950">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-slate-700">
              {headline ? (
                <span className="truncate">{headline}</span>
              ) : (
                <span className="italic text-slate-500">no headline yet</span>
              )}
              {headline ? (
                <ProvenancePill
                  source={pickSource(provenance, "headline", "linkedin")}
                  empty={!headline}
                />
              ) : (
                <ProvenancePill source="linkedin" empty />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
              {location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {location}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 italic text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  no location
                </span>
              )}
              {email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <a className="hover:underline" href={`mailto:${email}`}>
                    {email}
                  </a>
                </span>
              ) : null}
            </div>
          </div>

          <SyncStrip
            profile={profile}
            runs={runs}
            accountConnections={accountConnections}
            profileLoading={profileLoading}
          />
          <ProvenanceLegend />
        </div>
      </div>
    </section>
  );
}

function Avatar({
  name,
  src,
  size,
}: {
  name: string;
  src: string;
  size: number;
}): React.ReactElement {
  const initials = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const dim = `${size}px`;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/65 bg-slate-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_40px_rgba(15,23,42,0.18)]"
      style={{ width: dim, height: dim }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-serif text-[28px] tracking-tight">{initials}</span>
      )}
    </div>
  );
}

function SyncStrip({
  profile,
  runs,
  accountConnections,
  profileLoading,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  runs: Record<IntakeKind, IntakeRunRow | null | undefined>;
  accountConnections: ConnectedAccountsRow | undefined;
  profileLoading: boolean;
}): React.ReactElement {
  const sources = buildSourceSummaries({
    profile,
    runs,
    accountConnections,
    profileLoading,
  });

  return (
    <div className="space-y-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        source connections
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {sources.map((source) => (
          <SyncChip key={source.key} source={source} />
        ))}
      </div>
    </div>
  );
}

type SourceSummary = {
  key: string;
  label: string;
  status: SourceConnectionStatus;
  run?: IntakeRunRow | null;
  detail?: string;
};

function SyncChip({ source }: { source: SourceSummary }): React.ReactElement {
  const style = SOURCE_STATUS_STYLE[source.status];
  const Icon = style.icon;
  const runTime = source.run?.completedAt ?? source.run?.startedAt;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]",
        style.className,
      )}
      title={source.detail ?? style.label}
    >
      <Icon
        className={cx(
          "h-2.5 w-2.5",
          source.status === "loading" || source.status === "processing"
            ? "animate-spin"
            : "",
        )}
      />
      {source.label} · {style.label}
      {source.status === "done" && runTime ? (
        <>
          {" "}
          <RelativeTime iso={runTime} className="font-mono" />
        </>
      ) : null}
    </span>
  );
}

const SOURCE_STATUS_STYLE: Record<
  SourceConnectionStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  loading: {
    label: "Still loading",
    className: "border-slate-300/65 bg-white/35 text-slate-600",
    icon: Loader2,
  },
  "not-connected": {
    label: "Not connected",
    className: "border-dashed border-slate-300/65 bg-white/30 text-slate-500",
    icon: Link2,
  },
  saved: {
    label: "Saved",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    icon: CheckCircle2,
  },
  connected: {
    label: "Connected",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "border-[var(--color-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    icon: Loader2,
  },
  done: {
    label: "Done",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-red-500/35 bg-red-500/10 text-red-700",
    icon: AlertTriangle,
  },
};

function buildSourceSummaries({
  profile,
  runs,
  accountConnections,
  profileLoading,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  runs: Record<IntakeKind, IntakeRunRow | null | undefined>;
  accountConnections: ConnectedAccountsRow | undefined;
  profileLoading: boolean;
}): SourceSummary[] {
  const githubConnected = isGithubConnected(accountConnections);
  const linkedinSaved = Boolean(profile.links?.linkedin?.trim());
  const resumeSaved = Boolean(profile.resume?.filename?.trim());
  const webSaved = Boolean(
    profile.links?.website?.trim() || profile.links?.devpost?.trim(),
  );

  return [
    {
      key: "github",
      label: SOURCE_LABELS.github,
      status: getSourceConnectionStatus({
        loading: accountConnections === undefined || runs.github === undefined,
        connected: githubConnected,
        run: runs.github,
      }),
      run: runs.github,
      detail: githubConnected
        ? "GitHub OAuth token is connected"
        : "GitHub is not connected",
    },
    {
      key: "linkedin",
      label: SOURCE_LABELS.linkedin,
      status: getSourceConnectionStatus({
        loading: profileLoading || runs.linkedin === undefined,
        saved: linkedinSaved,
        run: runs.linkedin,
      }),
      run: runs.linkedin,
      detail: linkedinSaved
        ? "LinkedIn URL is saved and processing runs in the backend"
        : "LinkedIn URL has not been saved",
    },
    {
      key: "resume",
      label: SOURCE_LABELS.resume,
      status: getSourceConnectionStatus({
        loading: profileLoading || runs.resume === undefined,
        saved: resumeSaved,
        run: runs.resume,
      }),
      run: runs.resume,
      detail: resumeSaved ? profile.resume?.filename : "Resume has not been uploaded",
    },
    {
      key: "web",
      label: SOURCE_LABELS.web,
      status: getSourceConnectionStatus({
        loading: profileLoading || runs.web === undefined,
        saved: webSaved,
        run: runs.web,
      }),
      run: runs.web,
      detail: webSaved ? "Website or DevPost source is saved" : "No web source saved",
    },
    {
      key: "ai-report",
      label: SOURCE_LABELS["ai-report"],
      status: getSourceConnectionStatus({
        loading: runs["ai-report"] === undefined,
        run: runs["ai-report"],
      }),
      run: runs["ai-report"],
    },
  ];
}

function LoadingBanner(): React.ReactElement {
  return (
    <div
      className={cx(
        "flex items-center gap-2 border px-4 py-3 text-[12px] text-slate-600",
        mistClasses.card,
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" />
      Loading profile from Convex…
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity & contact
// ---------------------------------------------------------------------------

function IdentitySection({
  profile,
  provenance,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
}): React.ReactElement {
  const fields: Array<{
    key: string;
    label: string;
    value: string | undefined;
    fallbackSource: ProvenanceSource;
    icon: React.ComponentType<{ className?: string }>;
    href?: string;
  }> = [
    { key: "name", label: "Name", value: profile.name, fallbackSource: "github", icon: User2 },
    { key: "email", label: "Email", value: profile.email, fallbackSource: "github", icon: Mail, href: profile.email ? `mailto:${profile.email}` : undefined },
    { key: "location", label: "Location", value: profile.location, fallbackSource: "linkedin", icon: MapPin },
    { key: "headline", label: "Headline", value: profile.headline, fallbackSource: "linkedin", icon: Sparkles },
  ];

  const linkRows = Object.entries(profile.links ?? {}).filter(
    ([, v]) => Boolean(v),
  ) as Array<[string, string]>;

  return (
    <SectionCard
      kicker="01 · Identity"
      title="Identity & contact"
      description="Who you are, where you are, and how to reach you."
      rawData={{ profile: pick(profile, ["name", "email", "location", "headline", "summary", "links"]), provenance }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <FieldRow
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={f.value}
            href={f.href}
            source={pickSource(provenance, f.key, f.fallbackSource)}
            fallbackSource={f.fallbackSource}
          />
        ))}
      </div>

      {profile.summary ? (
        <div className="rounded-2xl border border-white/55 bg-white/35 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={mistClasses.sectionLabel}>summary</span>
            <ProvenancePill source={pickSource(provenance, "summary", "linkedin")} />
          </div>
          <Markdown>{profile.summary}</Markdown>
        </div>
      ) : null}

      {linkRows.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={mistClasses.sectionLabel}>links</span>
            <ProvenancePill source={pickSource(provenance, "links", "github")} />
          </div>
          <div className="flex flex-wrap gap-2">
            {linkRows.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/45 px-3 py-1 text-[12px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:bg-white/65"
              >
                <Link2 className="h-3 w-3" />
                <span className="font-medium">{key}</span>
                <span className="max-w-[180px] truncate text-slate-500">
                  {prettyUrl(url)}
                </span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300/55 bg-white/35 p-3 text-[12px] text-slate-500">
          No links yet. <ProvenancePill source="github" empty className="ml-1" />
          <ProvenancePill source="linkedin" empty className="ml-1" />
        </div>
      )}
    </SectionCard>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  href,
  source,
  fallbackSource,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | undefined;
  href?: string;
  source: ProvenanceSource;
  fallbackSource: ProvenanceSource;
}): React.ReactElement {
  const empty = !value || value.trim().length === 0;
  return (
    <div className="rounded-2xl border border-white/55 bg-white/30 p-3">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[14px] text-slate-900">
          {empty ? (
            <span className="italic text-slate-500">no data</span>
          ) : href ? (
            <a className="hover:underline" href={href}>
              {value}
            </a>
          ) : (
            value
          )}
        </div>
        <ProvenancePill source={empty ? fallbackSource : source} empty={empty} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

function ExperienceSection({
  profile,
  provenance,
  ghRun,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
  ghRun: IntakeRunRow | null | undefined;
}): React.ReactElement {
  const sorted = useMemo(
    () => {
      const items: ReadonlyArray<WorkExperience> = profile.experience ?? [];
      return [...items].sort((a, b) => {
        const ad = a.endDate || a.startDate || "";
        const bd = b.endDate || b.startDate || "";
        return bd.localeCompare(ad);
      });
    },
    [profile.experience],
  );

  const ghCommits = ghRun?.completedAt
    ? `Last GitHub intake completed `
    : null;

  return (
    <SectionCard
      kicker="02 · Experience"
      title="Experience timeline"
      description="LinkedIn-derived roles first, augmented by your GitHub commit cadence."
      meta={
        <>
          <ProvenancePill source="linkedin" empty={sorted.length === 0} />
          <ProvenancePill source="github" empty={!ghRun || ghRun.status !== "completed"} suffix=" commits" />
        </>
      }
      rawData={sorted}
      empty={
        sorted.length === 0
          ? {
              title: "No roles parsed yet",
              hint: (
                <>
                  Connect <ProvenancePill source="linkedin" empty className="mx-0.5" />
                  to populate roles, or upload a resume.
                </>
              ),
            }
          : undefined
      }
    >
      <ol className="relative ml-2 space-y-4 border-l border-slate-300/55 pl-5">
        {sorted.map((role, idx) => (
          <ExperienceItemRow
            key={`${role.company}::${role.title}::${idx}`}
            role={role}
            source={pickSource(
              provenance,
              `experience[${role.company}::${role.title}]`,
              "linkedin",
            )}
          />
        ))}
      </ol>

      {ghRun && ghRun.status === "completed" ? (
        <div className="rounded-2xl border border-white/55 bg-white/30 p-3">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
            <GitCommit className="h-3 w-3" />
            github commit timeline
            <ProvenancePill source="github" />
          </div>
          <div className="mt-1 text-[12px] text-slate-600">
            {ghCommits}
            <RelativeTime iso={ghRun.completedAt ?? ghRun.startedAt} />
            {" "}— see Projects below for per-repo activity.
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ExperienceItemRow({
  role,
  source,
}: {
  role: WorkExperience;
  source: ProvenanceSource;
}): React.ReactElement {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-glow)]" />
      <div className="rounded-2xl border border-white/55 bg-white/35 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
              <Briefcase className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate">{role.title || "(no title)"}</span>
              <span className="text-slate-400">·</span>
              <span className="truncate text-slate-700">
                {role.company || "(no company)"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-slate-500">
              {role.startDate || role.endDate ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {role.startDate ?? "?"} → {role.endDate ?? "present"}
                </span>
              ) : null}
              {role.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {role.location}
                </span>
              ) : null}
            </div>
          </div>
          <ProvenancePill source={source} />
        </div>
        {role.description ? (
          <p className="mt-2 text-[13px] leading-snug text-slate-600">
            {role.description}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

function EducationSection({
  profile,
  provenance,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
}): React.ReactElement {
  const items: ReadonlyArray<Education> = profile.education ?? [];
  return (
    <SectionCard
      kicker="03 · Education"
      title="Education"
      meta={<ProvenancePill source="linkedin" empty={items.length === 0} />}
      rawData={items}
      empty={
        items.length === 0
          ? {
              title: "No education parsed yet",
              hint: (
                <>
                  Connect{" "}
                  <ProvenancePill source="linkedin" empty className="mx-0.5" />
                  or upload a resume.
                </>
              ),
            }
          : undefined
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((edu, idx) => (
          <div
            key={`${edu.school}::${edu.degree}::${idx}`}
            className="rounded-2xl border border-white/55 bg-white/35 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-slate-900">
                <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                <span className="truncate">{edu.school}</span>
              </div>
              <ProvenancePill
                source={pickSource(provenance, `education[${edu.school}]`, "linkedin")}
              />
            </div>
            <div className="mt-0.5 text-[13px] text-slate-700">
              {[edu.degree, edu.field].filter(Boolean).join(" · ") || (
                <span className="italic text-slate-500">no degree info</span>
              )}
            </div>
            {edu.startDate || edu.endDate ? (
              <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                <Calendar className="h-3 w-3" />
                {edu.startDate ?? "?"} → {edu.endDate ?? "?"}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Projects (rich GitHub repo summaries)
// ---------------------------------------------------------------------------

function ProjectsSection({
  profile,
  provenance,
  repoSummaries,
  repoSummariesLoading,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
  repoSummaries: ReadonlyArray<RepoSummaryRow>;
  repoSummariesLoading: boolean;
}): React.ReactElement {
  // Build merged project list:
  //   1. rich repoSummaries (preferred — full whatItDoes + metadata)
  //   2. github.topRepos lightweight fallback for repos without summaries
  const summaryByName = useMemo(() => {
    const m = new Map<string, RepoSummaryRow>();
    for (const r of repoSummaries) m.set(r.repoFullName.toLowerCase(), r);
    return m;
  }, [repoSummaries]);

  const lightOnly = useMemo(() => {
    const topRepos: ReadonlyArray<GitHubRepo> = profile.github?.topRepos ?? [];
    return topRepos.filter((r) => {
      const fullName = (r.url || r.name).toLowerCase();
      // best-effort match by owner/name suffix in URL
      const candidates = [
        fullName,
        fullName.replace(/^https?:\/\/github\.com\//, ""),
      ];
      return !candidates.some((c) => summaryByName.has(c));
    });
  }, [profile.github?.topRepos, summaryByName]);

  const total = repoSummaries.length + lightOnly.length;
  const topRepos: ReadonlyArray<GitHubRepo> = profile.github?.topRepos ?? [];

  return (
    <SectionCard
      kicker="04 · Projects"
      title="Projects"
      description="Code-grounded summaries from your GitHub repos. Each panel is generated by reading the actual source files, not just the README."
      meta={
        <>
          <ProvenancePill source="github" empty={total === 0} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {total} {total === 1 ? "project" : "projects"}
          </span>
        </>
      }
      rawData={{ repoSummaries, topRepos }}
      empty={
        total === 0 && !repoSummariesLoading
          ? {
              title: "No projects yet",
              hint: (
                <>
                  Sign in with{" "}
                  <ProvenancePill source="github" empty className="mx-0.5" />
                  to pull repos and generate summaries.
                </>
              ),
            }
          : undefined
      }
    >
      {repoSummariesLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          loading rich summaries…
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {repoSummaries.map((row) => (
          <RepoSummaryCard key={row._id} row={row} />
        ))}
      </div>

      {lightOnly.length > 0 ? (
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-2">
            <span className={mistClasses.sectionLabel}>also on github</span>
            <ProvenancePill
              source={pickSource(provenance, "github", "github")}
              suffix=" (no summary yet)"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {lightOnly.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-2xl border border-white/55 bg-white/30 p-3 transition hover:bg-white/45"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                    <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{r.name}</span>
                  </div>
                  {r.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-600">
                      {r.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-slate-500">
                  {typeof r.stars === "number" ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {r.stars}
                    </span>
                  ) : null}
                  {r.language ? <span>{r.language}</span> : null}
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function RepoSummaryCard({ row }: { row: RepoSummaryRow }): React.ReactElement {
  const s = row.summary ?? {};
  const url = `https://github.com/${row.repoFullName}`;
  return (
    <article
      className={cx(
        "flex flex-col gap-3 border p-4",
        mistClasses.card,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 hover:underline"
          >
            <GitBranch className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate">{row.repoFullName}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" />
          </a>
          {s.oneLineDescription ? (
            <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-600">
              {s.oneLineDescription}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ProvenancePill source="github" />
          {s.starQuality ? (
            <StatusBadge tone={starToneFromQuality(s.starQuality)} variant="soft">
              {s.starQuality}
            </StatusBadge>
          ) : null}
        </div>
      </header>

      {s.whatItDoes ? (
        <div className="rounded-xl border border-white/55 bg-white/35 p-3">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <Sparkles className="h-3 w-3" />
            what it does
          </div>
          <p className="text-[13px] leading-relaxed text-slate-700">
            {s.whatItDoes}
          </p>
        </div>
      ) : null}

      {s.metadataSummary ? (
        <div className="rounded-xl border border-white/55 bg-white/22 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            metadata recap
          </div>
          <p className="text-[12.5px] leading-snug text-slate-600">
            {s.metadataSummary}
          </p>
        </div>
      ) : null}

      {s.notableImplementationDetails && s.notableImplementationDetails.length > 0 ? (
        <div className="rounded-xl border border-white/55 bg-white/22 p-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            notable implementation
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-slate-700">
            {s.notableImplementationDetails.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.keyTechnologies && s.keyTechnologies.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {s.keyTechnologies.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-white/65 bg-white/45 px-2 py-0.5 font-mono text-[10px] text-slate-700"
            >
              <Wrench className="h-2.5 w-2.5" />
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <footer className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
        <span className="truncate">model: {row.generatedByModel || "—"}</span>
        <RelativeTime iso={row.generatedAt} />
      </footer>
    </article>
  );
}

function starToneFromQuality(q: string): React.ComponentProps<typeof StatusBadge>["tone"] {
  switch (q.toLowerCase()) {
    case "showcase":
      return "success";
    case "solid":
      return "accent";
    case "experimental":
      return "warning";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Skills (grouped by source)
// ---------------------------------------------------------------------------

function SkillsSection({
  profile,
  provenance,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
}): React.ReactElement {
  const all = profile.skills ?? [];
  const ghLanguages = (profile.github?.topRepos ?? [])
    .map((r) => r.language)
    .filter((x): x is string => Boolean(x));
  const groups: Array<{ title: string; source: ProvenanceSource; items: string[] }> = [
    {
      title: "GitHub languages",
      source: "github",
      items: dedup(ghLanguages),
    },
    {
      title: "All skills",
      source: pickSource(provenance, "skills", "linkedin"),
      items: dedup(all),
    },
  ];

  const totalCount = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <SectionCard
      kicker="05 · Skills"
      title="Skills"
      description="Merged from GitHub language detection, LinkedIn skills, resume, and chat-derived signals."
      meta={
        <>
          <ProvenancePill source="github" empty={ghLanguages.length === 0} />
          <ProvenancePill source="linkedin" empty={all.length === 0} />
          <ProvenancePill source="chat" empty={all.length === 0} />
        </>
      }
      rawData={{ skills: all, ghLanguages, provenance: filterProvenance(provenance, "skills") }}
      empty={
        totalCount === 0
          ? {
              title: "No skills yet",
              hint: <>Connect GitHub or LinkedIn to populate.</>,
            }
          : undefined
      }
    >
      <div className="space-y-3">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.title}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={mistClasses.sectionLabel}>{g.title}</span>
                <ProvenancePill source={g.source} />
                <span className="font-mono text-[10px] text-slate-500">
                  {g.items.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-white/65 bg-white/45 px-2.5 py-0.5 text-[12px] text-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Extras: publications / honors / certifications / languages / interests
// ---------------------------------------------------------------------------

function ExtrasSection({
  profile,
  provenance,
}: {
  profile: NonNullable<UserProfileRow["profile"]>;
  provenance: Record<string, ProvenanceSource>;
}): React.ReactElement {
  const publications = (profile.publications ?? []) as ReadonlyArray<PublicationLike>;
  const honors = (profile.honors ?? []) as ReadonlyArray<HonorLike>;
  const certifications = (profile.certifications ?? []) as ReadonlyArray<CertificationLike>;
  const languages = (profile.spokenLanguages ?? []) as ReadonlyArray<LanguageLike>;
  const interests = (profile.interests ?? []) as ReadonlyArray<InterestLike>;

  const allEmpty =
    publications.length === 0 &&
    honors.length === 0 &&
    certifications.length === 0 &&
    languages.length === 0 &&
    interests.length === 0;

  return (
    <SectionCard
      kicker="06 · Extras"
      title="Publications, honors, certifications, languages, interests"
      meta={<ProvenancePill source="linkedin" empty={allEmpty} />}
      rawData={{ publications, honors, certifications, languages, interests }}
      empty={
        allEmpty
          ? {
              title: "No extras yet",
              hint: (
                <>
                  Connect <ProvenancePill source="linkedin" empty className="mx-0.5" /> to
                  populate publications, honors, certifications, languages, and
                  interests.
                </>
              ),
            }
          : undefined
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ExtrasCard
          title="Publications"
          icon={Newspaper}
          source={pickSource(provenance, "publications", "linkedin")}
          empty={publications.length === 0}
          emptyHint="Connect LinkedIn to import publications."
          items={publications.map((p, i) => ({
            id: `${p.title ?? ""}::${i}`,
            primary: p.title ?? "(untitled)",
            secondary: [p.venue, p.date].filter(Boolean).join(" · "),
            tertiary: p.authors?.join(", "),
            href: p.url,
          }))}
        />
        <ExtrasCard
          title="Honors"
          icon={Medal}
          source={pickSource(provenance, "honors", "linkedin")}
          empty={honors.length === 0}
          emptyHint="LinkedIn awards land here."
          items={honors.map((h, i) => ({
            id: `${h.title ?? ""}::${i}`,
            primary: h.title ?? "(untitled)",
            secondary: [h.issuer, h.date].filter(Boolean).join(" · "),
            tertiary: h.description,
          }))}
        />
        <ExtrasCard
          title="Certifications"
          icon={BookOpen}
          source={pickSource(provenance, "certifications", "linkedin")}
          empty={certifications.length === 0}
          emptyHint="Resume-parsed certifications appear here."
          items={certifications.map((c, i) => ({
            id: `${c.name ?? ""}::${i}`,
            primary: c.name ?? "(unnamed)",
            secondary: [c.issuer, c.issueDate].filter(Boolean).join(" · "),
            href: c.url,
          }))}
        />
        <ExtrasCard
          title="Spoken languages"
          icon={Languages}
          source={pickSource(provenance, "spokenLanguages", "linkedin")}
          empty={languages.length === 0}
          emptyHint="LinkedIn language section feeds this."
          items={languages.map((l, i) => ({
            id: `${l.language ?? ""}::${i}`,
            primary: l.language ?? "(unspecified)",
            secondary: l.proficiency,
          }))}
        />
        <ExtrasCard
          title="Interests"
          icon={Heart}
          source={pickSource(provenance, "interests", "linkedin")}
          empty={interests.length === 0}
          emptyHint="Add via LinkedIn or chat."
          items={interests.map((i, idx) => ({
            id: `${i.name ?? ""}::${idx}`,
            primary: i.name ?? "(unspecified)",
          }))}
        />
        <ExtrasCard
          title="Companies snapshot"
          icon={Building2}
          source={pickSource(provenance, "experience", "linkedin")}
          empty={(profile.experience ?? []).length === 0}
          emptyHint="Past employers will roll up here."
          items={dedup((profile.experience ?? []).map((e) => e.company)).map(
            (c, i) => ({ id: `${c}::${i}`, primary: c }),
          )}
        />
      </div>
    </SectionCard>
  );
}

interface ExtrasItem {
  id: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  href?: string;
}

function ExtrasCard({
  title,
  icon: Icon,
  source,
  items,
  empty,
  emptyHint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  source: ProvenanceSource;
  items: ReadonlyArray<ExtrasItem>;
  empty: boolean;
  emptyHint: string;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-white/55 bg-white/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-900">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          {title}
        </div>
        <ProvenancePill source={source} empty={empty} />
      </div>
      {empty ? (
        <p className="text-[12px] italic text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-white/55 bg-white/35 p-2 text-[12.5px] text-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {item.primary}
                      </a>
                    ) : (
                      item.primary
                    )}
                  </div>
                  {item.secondary ? (
                    <div className="truncate text-[11px] text-slate-500">
                      {item.secondary}
                    </div>
                  ) : null}
                  {item.tertiary ? (
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {item.tertiary}
                    </div>
                  ) : null}
                </div>
                {item.href ? (
                  <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debug footer (full-blob raw drawer)
// ---------------------------------------------------------------------------

function DebugFooter({
  profileRow,
  repoSummaryCount,
}: {
  profileRow: UserProfileRow | null | undefined;
  repoSummaryCount: number;
}): React.ReactElement {
  return (
    <SectionCard
      kicker="99 · Debug"
      title="Full profile blob"
      description="Everything the canonical Convex doc currently holds for this user."
      rawData={profileRow ?? null}
      meta={
        <>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            updated
          </span>
          <RelativeTime
            iso={profileRow?.updatedAt}
            className="font-mono text-[10px] text-slate-600"
            empty="never"
          />
          <Link
            href="/settings"
            className="ml-2 rounded-full border border-white/65 bg-white/45 px-2.5 py-0.5 font-mono text-[10px] text-slate-700 hover:bg-white/65"
          >
            settings
          </Link>
        </>
      }
    >
      <div className="text-[12px] text-slate-600">
        Subscriptions live: <span className="font-mono">userProfiles</span>,{" "}
        <span className="font-mono">intakeRuns × 6</span>,{" "}
        <span className="font-mono">repoSummaries</span> ({repoSummaryCount}).
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickSource(
  provenance: Record<string, ProvenanceSource>,
  field: string,
  fallback: ProvenanceSource,
): ProvenanceSource {
  return provenance[field] ?? fallback;
}

function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: ReadonlyArray<K>,
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function filterProvenance(
  provenance: Record<string, ProvenanceSource>,
  prefix: string,
): Record<string, ProvenanceSource> {
  const out: Record<string, ProvenanceSource> = {};
  for (const [k, v] of Object.entries(provenance)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  return out;
}

function dedup(items: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item?.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
  }
  return out;
}

function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}
