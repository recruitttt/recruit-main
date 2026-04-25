import Link from "next/link";
import type * as React from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleStop,
  ClipboardList,
  Clock3,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Mail,
  MonitorPlay,
  Pause,
  Play,
  PlugZap,
  Power,
  RefreshCw,
  RotateCw,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  X,
} from "lucide-react";
import {
  AgentCoreIcon,
  ApplicationSendIcon,
  MatchSignalIcon,
  PipelinePathIcon,
  ResumeTailorIcon,
  RoleRadarIcon,
  type RecruitIconProps,
} from "@/components/recruit-icons";
import {
  ActionButton as Button,
  ArtifactCard,
  BrowserPreview,
  DiffViewer,
  EventLog,
  type EventLogItem,
  FilterChip as GlassTag,
  GlassCard,
  Panel,
  RunStatusIndicator,
  SelectField,
  StatusBadge as Pill,
  TextField,
  Toggle,
  cx,
  getStatusColor,
  mistClasses,
  mistColors,
  type StatusTone,
} from "@/components/design-system";

type VariantKey = "lightMist";

const variants = {
  lightMist: {
    eyebrow: "D / Light Glass Mist",
    title: "Misty blue glass cockpit",
    description: "Cool gray-blue glass with cyan telemetry and stronger app energy. Best if Recruit should feel intelligent and technical without going dark.",
    pageBg: "bg-[#CDD5DF]",
    panel: mistClasses.panel,
    panelAlt: mistClasses.card,
    text: "text-[#101827]",
    muted: "text-[#465568]",
    subtle: "text-[#6B7A90]",
    accent: mistColors.accent,
    accent2: mistColors.neutral,
    success: mistColors.success,
    radius: "rounded-[24px]",
    fontTitle: "font-serif",
    button: "border-[#0F172A] bg-[#0F172A] text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]",
    nav: "border-white/45 bg-white/38 shadow-[0_14px_40px_rgba(15,23,42,0.07)] backdrop-blur-2xl",
  },
} as const;

const scores = [
  ["Skills", "98%"],
  ["Experience", "93%"],
  ["Culture", "92%"],
  ["Role alignment", "96%"],
];

const componentRows = [
  ["OpenSesame", "Software Engineering Intern", "Greenhouse", "submitted", "88", "8.4", "resume + cover"],
  ["Cloudflare", "Software Engineer Intern", "Greenhouse", "submitted", "91", "8.7", "DLQ resolved"],
  ["Forerunner", "Software Engineering Intern", "Greenhouse", "submitted", "84", "8.1", "cache reused"],
  ["Radiant", "Summer 2026 Software Engineering Internship", "Greenhouse", "submitting", "86", "8.3", "live session"],
];

const recruitIcons: Array<{
  label: string;
  description: string;
  icon: (props: RecruitIconProps) => React.ReactNode;
  tone: PillTone;
  accent2: string;
}> = [
  { label: "Agent Core", description: "Autonomous system active", icon: AgentCoreIcon, tone: "accent", accent2: "#16A34A" },
  { label: "Role Radar", description: "Role discovery scan", icon: RoleRadarIcon, tone: "accent", accent2: "#16A34A" },
  { label: "Match Signal", description: "Fit and signal graph", icon: MatchSignalIcon, tone: "accent", accent2: "#16A34A" },
  { label: "Resume Tailor", description: "Material customization", icon: ResumeTailorIcon, tone: "success", accent2: "#0EA5E9" },
  { label: "Application Send", description: "Submission handoff", icon: ApplicationSendIcon, tone: "accent", accent2: "#16A34A" },
  { label: "Pipeline Path", description: "Lifecycle progression", icon: PipelinePathIcon, tone: "success", accent2: "#0EA5E9" },
];

const agentRuns = [
  ["Run 042", "Active", "18 apps", "2.1/min"],
  ["Run 041", "Replayed", "12 apps", "0 errors"],
  ["Run 040", "Paused", "7 apps", "DLQ: 2"],
];

const approvalItems = [
  ["Linear", "Senior Product Manager", "95%", "safe"],
  ["Ramp", "Growth Product Lead", "91%", "safe"],
  ["Radiant", "SWE Intern", "86%", "review"],
];

const documentDiff = {
  original: ["Built internal tools for data workflows.", "Supported PM and engineering planning.", "Improved reporting reliability."],
  proposed: ["Built agentic data workflows used by product and engineering.", "Led PM-facing planning systems across ambiguous requirements.", "Improved reporting reliability with automated validation checks."],
  rationale: ["Added agentic workflow language for role fit.", "Strengthened ownership verbs.", "Preserved factual scope and locked identity fields."],
  locked: ["Name", "Email", "Phone", "Years exp", "Education"],
};

const roleDetails = {
  company: "Linear",
  role: "Senior Product Manager",
  requirements: ["B2B workflow depth", "AI product judgment", "Strong written communication"],
  signals: ["Series C", "Team 90-120", "Remote friendly", "Recent AI launch"],
  blockers: ["Portfolio upload optional", "Comp range not listed"],
};

const dlqItems = [
  ["Radiant", "Needs portfolio upload", "stuck at optional upload step"],
  ["Mercury", "Work authorization question", "requires human confirmation"],
  ["Vanta", "Apply button hidden", "page changed after auth redirect"],
];

const eventLogItems: EventLogItem[] = [
  { time: "09:41", type: "seen", title: "Parsed Linear JD", detail: "Detected workflow quality, AI judgment, and product-led growth requirements." },
  { time: "09:42", type: "decision", title: "Chose AI Product resume", detail: "Best variant for agent UX and product workflow evidence." },
  { time: "09:43", type: "tool", title: "Wrote cover letter", detail: "Generated concise product-minded draft with role-specific proof." },
  { time: "09:44", type: "success", title: "Queued for approval", detail: "Locked identity fields were preserved before submission." },
];

const personaSettings = {
  targets: ["Product Engineer", "AI PM", "Growth Product"],
  locations: ["Remote", "San Francisco", "Vancouver"],
  blocked: ["Crypto casinos", "Defense", "Commission-only"],
  variants: ["General SWE", "AI Product", "Data Platform"],
};

const notifications = [
  ["Interview", "Notion replied with a screen request", "email + push"],
  ["Blocker", "Mercury needs work authorization approval", "push"],
  ["Response", "Linear application moved to review", "email"],
];

const analyticsRows = [
  ["Greenhouse", "Applied", "23", "11.2%"],
  ["Lever", "Interview", "6", "8.7%"],
  ["Workday", "DLQ", "9", "21.4%"],
];

const auditRows = [
  ["Apr 23 17:42", "Linear", "Senior Product Manager", "Greenhouse", "submitted"],
  ["Apr 23 16:18", "Ramp", "Growth Product Lead", "Lever", "submitted"],
  ["Apr 23 15:06", "Radiant", "SWE Intern", "Greenhouse", "paused"],
];

const providerCoverage = [
  ["Ashby", "live proof", "success", "1 confirmed run"],
  ["Greenhouse", "stretch", "neutral", "direct-form only"],
  ["Lever", "target needed", "warning", "validation pending"],
  ["Workday", "replay only", "neutral", "seeded artifact"],
] as const;

const questionMapRows = [
  ["Full name", "profile truth", "locked", "Owen Fisher"],
  ["Portfolio URL", "approved answer", "cached", "owenfisher.dev"],
  ["Work authorization", "human required", "blocked", "needs approval"],
  ["Resume upload", "artifact", "ready", "AI Product PDF"],
] as const;

const cacheRows = [
  ["Portfolio URL", "safe reusable", "12 future forms"],
  ["Source question", "approved once", "Greenhouse + Ashby"],
  ["Project demo link", "candidate truth", "always allowed"],
] as const;

const intakeReadinessRows = [
  ["Profile", "complete", "success"],
  ["Work authorization", "needs review", "warning"],
  ["Links", "complete", "success"],
  ["Hard blocks", "active", "neutral"],
] as const;

const proofRows = [
  ["Confirmed submit", "success", "Ashby success banner + final URL captured"],
  ["Spam rejected", "warning", "Post-submit rejection classified honestly"],
  ["Ambiguous", "neutral", "Needs replay or screenshot before claim"],
  ["Unsupported gate", "danger", "Run blocked before unsafe action"],
] as const;

const pricingTiers = [
  ["Free", "$0", "Manual review", "10 tracked applications"],
  ["Standard", "$19", "Human-in-loop", "50 assisted applications"],
  ["Pro", "$49", "Autonomous agent", "Unlimited runs + cache memory"],
] as const;

function Shell({ variantKey, children }: { variantKey: VariantKey; children: React.ReactNode }) {
  const v = variants[variantKey];

  return (
    <main className={cx("min-h-screen overflow-x-hidden px-6 py-7", v.pageBg, v.text)}>
      <div className="mx-auto min-w-0 max-w-[1500px] space-y-6">
        <nav className={cx("flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", v.radius, v.nav)}>
          <Link href="/design-system/light-glass-mist" className="flex items-center gap-3">
            <span className={cx("flex h-9 w-9 items-center justify-center border text-xl", v.radius)} style={{ borderColor: v.accent, color: v.accent }}>
              r
            </span>
            <span>
              <span className={cx("block text-sm font-semibold", v.text)}>recruit mist system</span>
              <span className={cx("block font-mono text-[11px]", v.subtle)}>{v.eyebrow}</span>
            </span>
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}

type PillTone = StatusTone;

function getToneColor(variantKey: VariantKey, tone: PillTone) {
  void variantKey;
  return getStatusColor(tone);
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 34" className="h-7 w-full overflow-visible">
      <path d="M2 29 L16 22 L28 25 L43 12 L58 18 L74 8 L91 15 L107 6 L118 4" fill="none" stroke={color} strokeWidth="2" />
      <path d="M2 29 L16 22 L28 25 L43 12 L58 18 L74 8 L91 15 L107 6 L118 4 L118 34 L2 34 Z" fill={color} opacity="0.12" />
    </svg>
  );
}

function HeroGraphic({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <div className={cx("relative min-h-[330px] overflow-hidden border", v.radius, v.panelAlt)}>
      <div className="absolute left-1/2 top-1/2 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border opacity-40" style={{ borderColor: v.accent }} />
      <div className="absolute left-1/2 top-1/2 h-56 w-80 -translate-x-1/2 -translate-y-1/2 rotate-[24deg] rounded-[50%] border opacity-34" style={{ borderColor: v.accent2 }} />
      <div className="absolute left-1/2 top-1/2 h-36 w-72 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-[50%] border opacity-32" style={{ borderColor: v.accent2 }} />
      <div className={cx("absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center border text-5xl", v.radius, v.fontTitle)} style={{ borderColor: v.accent, boxShadow: `0 0 32px ${v.accent}2E` }}>
        r
      </div>
      <span className="absolute left-[18%] top-[32%] h-2 w-2 rounded-full" style={{ backgroundColor: v.accent, boxShadow: `0 0 12px ${v.accent}` }} />
      <span className="absolute left-[70%] top-[24%] h-2 w-2 rounded-full" style={{ backgroundColor: v.accent2, boxShadow: `0 0 12px ${v.accent2}` }} />
      <span className="absolute left-[74%] top-[62%] h-2 w-2 rounded-full" style={{ backgroundColor: v.accent2, boxShadow: `0 0 12px ${v.accent2}` }} />
    </div>
  );
}

function MistWorkbench({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <Panel variantKey={variantKey} title="Typography & Core Tokens">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1fr]">
            <div>
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Display</div>
              <h2 className="mt-3 font-serif text-6xl font-light tracking-[-0.05em] text-slate-950">Misty Glass</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Cool gray-blue glass, cyan telemetry, quiet slate text, and product-focused density.
              </p>
            </div>
            <GlassCard>
              {[
                ["Page title", "48 / serif / light", "font-serif text-5xl font-light tracking-[-0.04em]"],
                ["Section title", "20 / sans / semibold", "text-xl font-semibold"],
                ["Body", "14 / sans / regular", "text-sm leading-6"],
                ["Meta label", "11 / mono / uppercase", "font-mono text-[11px] uppercase tracking-[0.2em]"],
                ["Numeric", "24 / mono", "font-mono text-2xl"],
              ].map(([label, spec, className]) => (
                <div key={label} className="grid grid-cols-[0.9fr_1fr] gap-3 border-b border-white/45 py-3 last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{label}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{spec}</div>
                  </div>
                  <div className={cx("text-slate-950", className)}>Recruit</div>
                </div>
              ))}
            </GlassCard>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {["#CDD5DF", "#F8FBFF4D", "#0EA5E9", "#64748B"].map((color) => (
              <GlassCard key={color} density="compact">
                <div className="h-12 rounded-[inherit] border border-white/70" style={{ backgroundColor: color }} />
                <div className="mt-2 font-mono text-xs text-slate-500">{color}</div>
              </GlassCard>
            ))}
          </div>
        </Panel>

        <Panel variantKey={variantKey} title="Buttons, Pills & Navigation">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button variantKey={variantKey}><Sparkles className="h-4 w-4" /> Primary</Button>
              <Button variantKey={variantKey} secondary><FileText className="h-4 w-4" /> Secondary</Button>
              <Button variant="ghost">
                Ghost <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="danger">
                <TriangleAlert className="h-4 w-4" /> Destructive
              </Button>
              <Button variant="secondary" className="w-10 px-0" aria-label="Icon button">
                <Bell className="h-4 w-4 text-slate-600" />
              </Button>
              <Button loading className="opacity-85">Sync</Button>
              <Button disabled variant="secondary">Disabled</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <GlassTag variantKey={variantKey} label="Applied" />
              <GlassTag variantKey={variantKey} label="Submitted" tone="success" />
              <GlassTag variantKey={variantKey} label="Reviewing" tone="warning" />
              <GlassTag variantKey={variantKey} label="DLQ" tone="danger" />
              <GlassTag variantKey={variantKey} label="Saved" tone="neutral" />
            </div>
            <GlassCard className="space-y-4">
              <div>
                <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">01 / Dot glass default</div>
                <div className="flex flex-wrap gap-2">
                  <GlassTag variantKey={variantKey} label="95% match" />
                  <GlassTag variantKey={variantKey} label="Submitted" tone="success" />
                  <GlassTag variantKey={variantKey} label="Needs review" tone="warning" />
                  <GlassTag variantKey={variantKey} label="Blocked" tone="danger" />
                </div>
              </div>
              <div>
                <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">02 / Secondary control shape</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Provider", Filter],
                    ["Status", SlidersHorizontal],
                    ["Date", CalendarClock],
                  ].map(([label, Icon]) => (
                    <button
                      key={label as string}
                      className="inline-flex h-11 items-center gap-3 rounded-full border border-white/70 bg-white/54 px-5 text-base font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur-xl"
                    >
                      <Icon className="h-5 w-5 text-slate-700" strokeWidth={1.75} />
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">03 / Removable filters</div>
                <div className="flex flex-wrap gap-2">
                  {["Remote", "Backend", "Internship", "Canada"].map((item) => (
                    <GlassTag key={item} variantKey={variantKey} label={item} mode="filter" tone="neutral" />
                  ))}
                </div>
              </div>
            </GlassCard>
            <GlassCard density="compact" className="flex flex-wrap items-center gap-2">
              {[
                ["Dashboard", Bot],
                ["Applications", FileText],
                ["Agents", Sparkles],
                ["Settings", Settings],
              ].map(([label, Icon], index) => (
                <button key={label as string} className={cx("inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold", index === 0 ? "bg-white/55 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.08)]" : "text-slate-600")}>
                  <Icon className="h-4 w-4" style={{ color: index === 0 ? v.accent : undefined }} />
                  {label as string}
                </button>
              ))}
            </GlassCard>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
        <Panel variantKey={variantKey} title="Form Controls">
          <div className="space-y-3">
            <TextField placeholder="Search roles, companies, blockers..." icon={<Search className="h-4 w-4 text-slate-500" />} />
            <SelectField value="Select provider" />
            <GlassCard density="compact" className="flex flex-wrap gap-2">
              {["Remote", "Backend", "Internship", "Canada"].map((item) => (
                <GlassTag key={item} variantKey={variantKey} label={item} mode="filter" tone="neutral" />
              ))}
            </GlassCard>
            <TextField multiline placeholder="Add a note for your agent..." />
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="Human approval" checked />
              <Toggle label="Auto-submit" checked={false} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Error" value="Missing portfolio URL" state="error" helper="Required before this provider can continue." />
              <TextField label="Disabled" value="Locked by resume base" state="disabled" helper="Protected profile field." />
              <SelectField label="Review state" value="Needs approval" state="error" helper="Route to approval queue." />
              <Toggle label="Paused provider" checked={false} disabled />
            </div>
          </div>
        </Panel>

        <Panel variantKey={variantKey} title="Application Table">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button size="sm" variant="secondary">
              <Filter className="h-4 w-4" /> Provider
            </Button>
            <Button size="sm" variant="secondary">
              <SlidersHorizontal className="h-4 w-4" /> Status
            </Button>
            <Button size="sm" variant="secondary">
              <CalendarClock className="h-4 w-4" /> Date
            </Button>
          </div>
          <div className={cx("overflow-x-auto border", v.radius, v.panelAlt)}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/50 text-left text-xs text-slate-500">
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Provider</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">ATS</th>
                  <th className="px-3 py-3 font-medium">Persona</th>
                  <th className="px-3 py-3 font-medium">Artifacts</th>
                </tr>
              </thead>
              <tbody>
                {componentRows.map(([company, role, provider, status, ats, persona, artifacts]) => (
                  <tr key={`${company}-${role}`} className="border-b border-white/40 transition hover:bg-white/20 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-slate-950">{company}</td>
                    <td className="px-3 py-2.5 text-slate-600">{role}</td>
                    <td className="px-3 py-2.5 text-slate-600">{provider}</td>
                    <td className="px-3 py-2.5"><Pill variantKey={variantKey} tone={status === "submitted" ? "success" : status === "submitting" ? "warning" : "neutral"}>{status}</Pill></td>
                    <td className="px-3 py-2.5 font-mono text-slate-950">{ats}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-950">{persona}</td>
                    <td className="px-3 py-2.5 text-slate-600">{artifacts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel variantKey={variantKey} title="Metric & Status Cards">
          <div className="grid gap-3">
            {[
              ["Agents Running", "6", Bot, "+2 handoffs"],
              ["Provider Coverage", "4/4", ShieldCheck, "all active"],
              ["Cache Reuse", "67.8%", Database, "312 answers"],
              ["Time Saved", "18.5h", Clock3, "7 day window"],
            ].map(([label, value, Icon, note]) => (
              <GlassCard key={label as string}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">{label as string}</div>
                  <Icon className={cx("h-4 w-4", label === "Agents Running" ? "text-sky-500" : "text-slate-500")} />
                </div>
                <div className="mt-2 font-mono text-3xl text-slate-950">{value as string}</div>
                <div className="mt-1 text-sm text-slate-500">{note as string}</div>
                <Sparkline color={label === "Agents Running" ? v.accent : v.accent2} />
              </GlassCard>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr_0.8fr]">
        <Panel variantKey={variantKey} title="Recruit Modules">
          <div className="grid gap-4 md:grid-cols-2">
            <GlassCard>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Radiant</h3>
                  <p className="mt-1 text-sm text-slate-600">Software Engineering Internship</p>
                </div>
                <Pill variantKey={variantKey} tone="warning">submitting</Pill>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((step) => (
                  <div key={step} className="h-2 rounded-full" style={{ backgroundColor: step < 4 ? v.accent : "rgba(100,116,139,0.18)" }} />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>Browser session active</span>
                <span className="font-mono">03:24</span>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">DLQ Recovery</h3>
                  <p className="mt-1 text-sm text-slate-600">Visa answer requires approval.</p>
                </div>
                <TriangleAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div className="mt-5 space-y-2">
                {["Question captured", "Form state saved", "Resume attached"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </Panel>

        <Panel variantKey={variantKey} title="Timeline">
          <EventLog events={eventLogItems} compact />
        </Panel>

        <Panel variantKey={variantKey} title="Artifact List">
          <div className="space-y-3">
            {[
              ["Tailored resume", "PDF ready", "file"],
              ["Cover letter", "Generated", "file"],
              ["Job snapshot", "Archived", "attachment"],
              ["Browser recording", "Attached", "preview"],
            ].map(([label, meta, type]) => (
              <ArtifactCard key={label} title={label} meta={meta} type={type as "file" | "preview" | "attachment"} />
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function CustomIconLab({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="Custom Icon Lab">
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard>
          <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">01 / Pillow navigation</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recruitIcons.map(({ label, icon: Icon, tone, accent2 }) => {
              const color = getToneColor(variantKey, tone);

              return (
                <button
                  key={label}
                  className="group inline-flex h-14 items-center gap-3 rounded-full border border-white/75 bg-white/50 px-4 text-sm font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_15px_34px_rgba(15,23,42,0.07)] backdrop-blur-xl transition hover:bg-white/64"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/75 bg-white/46 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_rgba(15,23,42,0.08)]"
                    style={{ color }}
                  >
                    <Icon className="h-[21px] w-[21px]" accent={color} accent2={accent2} />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {recruitIcons.slice(0, 3).map(({ label, icon: Icon, tone, accent2 }) => {
              const color = getToneColor(variantKey, tone);

              return (
                <span key={label} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/70 bg-white/38 px-3 text-xs font-semibold text-slate-700">
                  <Icon className="h-4 w-4" accent={color} accent2={accent2} />
                  {label}
                </span>
              );
            })}
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard>
            <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">02 / Favicon candidates</div>
            <div className="flex flex-wrap gap-3">
              {recruitIcons.slice(0, 3).map(({ label, icon: Icon, tone, accent2 }) => {
                const color = getToneColor(variantKey, tone);

                return (
                  <span
                    key={label}
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/70 bg-white/46 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_24px_rgba(15,23,42,0.055)]"
                  >
                    <Icon className="h-7 w-7" accent={color} accent2={accent2} />
                  </span>
                );
              })}
            </div>
          </GlassCard>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recruitIcons.map(({ label, description, icon: Icon, tone, accent2 }) => {
                const color = getToneColor(variantKey, tone);

                return (
                  <GlassCard key={label} density="compact" className="opacity-85">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/75 bg-white/50 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_14px_28px_rgba(15,23,42,0.07)]"
                        style={{ color }}
                      >
                        <Icon className="h-7 w-7" accent={color} accent2={accent2} />
                      </span>
                      <Icon className="h-6 w-6 text-slate-700" accent={color} accent2={accent2} />
                    </div>
                    <div className="mt-4">
                      <div className="text-sm font-semibold text-slate-950">{label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
                    </div>
                  </GlassCard>
                );
              })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function GallerySectionHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-2 border-t border-white/40 pb-1 pt-9 md:grid-cols-[0.34fr_1fr]">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{kicker}</div>
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function ApplicationDetailGallery({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="Application Detail Card">
      <GlassCard>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Linear</h3>
            <p className="mt-1 text-sm text-slate-600">Senior Product Manager</p>
            <p className="text-sm text-slate-500">San Francisco, CA + Hybrid</p>
          </div>
          <Pill variantKey={variantKey} tone="success">High match</Pill>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill variantKey={variantKey}>95% Match</Pill>
          <Pill variantKey={variantKey} tone="neutral">Culture Fit</Pill>
          <Pill variantKey={variantKey} tone="neutral">Resume Tailored</Pill>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {["Found", "Tailored", "Applied", "Screen", "Offer"].map((step, index) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs" style={{ borderColor: index <= 2 ? v.accent : `${v.accent}33`, backgroundColor: index <= 2 ? `${v.accent}22` : "transparent", color: index <= 2 ? v.accent : undefined }}>
                {index < 2 ? <Check className="h-4 w-4" /> : index === 2 ? "3" : ""}
              </div>
              <div className={cx("mt-2 text-[11px]", index === 2 ? v.text : v.subtle)}>{step}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </Panel>
  );
}

function MatchBreakdownGallery({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="Match Breakdown">
      <div className="grid gap-5 md:grid-cols-[150px_1fr]">
        <div className="flex justify-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-full p-3" style={{ background: `conic-gradient(${v.accent} 0 95%, rgba(100,116,139,0.2) 95% 100%)`, boxShadow: `0 0 30px ${v.accent}22` }}>
            <div className={cx("flex h-32 w-32 flex-col items-center justify-center rounded-full border", v.panelAlt)}>
              <div className="font-serif text-4xl">95%</div>
              <div className="text-xs text-slate-500">Overall</div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {scores.map(([label, value]) => (
            <div key={label}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
              <MiniMeter value={Number(value.replace("%", ""))} color={v.accent} />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function SystemStatesGallery({ variantKey }: { variantKey: VariantKey }) {
  const states = [
    ["Running", "Agent is submitting Linear", "accent", "Current step: attach tailored resume"],
    ["Loading", "Provider data is syncing", "active", "Cache refresh in progress"],
    ["Needs approval", "Resume diff requires review", "warning", "Human review required before submit"],
    ["Blocked", "Portfolio upload stopped run", "danger", "One-click retry or skip"],
    ["Submitted", "Audit record created", "success", "Immutable record available"],
    ["Empty", "No blockers in queue", "neutral", "Show calm empty state"],
  ] as const;

  return (
    <Panel variantKey={variantKey} title="Status, Empty & Error States">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {states.map(([label, copy, tone, detail]) => (
          <GlassCard key={label} density="compact" variant={tone === "danger" ? "critical" : tone === "active" ? "selected" : "default"}>
            <Pill variantKey={variantKey} tone={tone}>{label}</Pill>
            <div className="mt-4 text-sm leading-6 text-slate-600">{copy}</div>
            <div className="mt-3 text-xs leading-5 text-slate-500">{detail}</div>
          </GlassCard>
        ))}
      </div>
    </Panel>
  );
}

function MiniMeter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-900/10">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function AgentControlPanel({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="01 / Agent Control Panel">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <GlassCard>
          <div className="flex items-center justify-between">
            <Pill variantKey={variantKey} tone="active">run active</Pill>
            <span className="font-mono text-xs text-slate-500">RUN-042</span>
          </div>
          <div className="mt-4">
            <RunStatusIndicator state="running" label="Linear application run" meta="Current step: attach tailored resume" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Button size="sm" variant="success"><Play className="h-3.5 w-3.5" /> Start</Button>
            <Button size="sm" variant="secondary"><Pause className="h-3.5 w-3.5" /> Pause</Button>
            <Button size="sm" variant="danger"><CircleStop className="h-3.5 w-3.5" /> Stop</Button>
          </div>
          <Button variant="dangerStrong" size="lg" className="mt-4 h-16 w-full text-base font-bold">
            <Power className="h-5 w-5" /> Kill all agent activity
          </Button>
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-600"><span>Concurrency</span><span>3 active</span></div>
              <MiniMeter value={60} color={v.accent} />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-600"><span>Rate limit</span><span>2.1/min</span></div>
              <MiniMeter value={42} color={v.success} />
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><History className="h-4 w-4" /> Run history</div>
          <div className="space-y-2">
            {agentRuns.map(([run, status, apps, rate]) => (
              <GlassCard key={run} density="compact" variant="muted" className="grid grid-cols-[76px_1fr_auto] items-center gap-3 rounded-[18px] text-sm">
                <span className="font-mono text-xs text-slate-500">{run}</span>
                <span><span className="font-semibold text-slate-900">{status}</span><span className="ml-2 text-slate-500">{apps}</span></span>
                <Button size="sm" variant="secondary"><RotateCw className="h-3 w-3" /> Replay</Button>
                <span className="col-start-2 text-xs text-slate-500">{rate}</span>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </div>
    </Panel>
  );
}

function ApprovalQueue({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="02 / Approval Queue">
      <div className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <div className="space-y-2">
          {approvalItems.map(([company, role, match, risk], index) => (
            <GlassCard key={company} density="compact" variant={index === 0 ? "selected" : "default"}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{company}</div>
                  <div className="mt-1 text-xs text-slate-500">{role}</div>
                </div>
                <Pill variantKey={variantKey} tone={risk === "safe" ? "success" : "warning"}>{match}</Pill>
              </div>
            </GlassCard>
          ))}
          <GlassCard density="compact">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Bulk approve threshold</span><span className="text-emerald-600">90%+ only</span>
            </div>
            <MiniMeter value={72} color={v.success} />
          </GlassCard>
        </div>
        <GlassCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-950">Linear submission preview</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success"><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button size="sm" variant="secondary"><FileText className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="danger"><X className="h-3.5 w-3.5" /> Reject</Button>
            </div>
          </div>
          <DiffViewer before={documentDiff.original} after={documentDiff.proposed} />
        </GlassCard>
      </div>
    </Panel>
  );
}

function DocumentDiffViewer({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="03 / Resume & Cover Letter Diff">
      <DiffViewer before={documentDiff.original} after={documentDiff.proposed} rationale={documentDiff.rationale} locked={documentDiff.locked} />
    </Panel>
  );
}

function RoleDetailDrawer({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="04 / Company & Role Detail Drawer">
      <GlassCard>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold text-slate-950"><Building2 className="h-5 w-5 text-slate-500" /> {roleDetails.company}</div>
            <div className="mt-1 text-sm text-slate-600">{roleDetails.role}</div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Own workflow quality, agent UX, and product-led growth systems for a fast-moving SaaS team.</p>
          </div>
          <div className="space-y-2">
            {roleDetails.requirements.map((item) => (
              <GlassCard key={item} density="compact" className="flex items-center justify-between rounded-[18px] text-sm text-slate-700">
                {item}<span className="font-mono text-xs text-sky-600">match</span>
              </GlassCard>
            ))}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">{roleDetails.signals.map((item) => <GlassTag key={item} variantKey={variantKey} label={item} tone="neutral" />)}</div>
            <div className="mt-3 space-y-2">{roleDetails.blockers.map((item) => <div key={item} className="text-xs leading-5 text-slate-500">Blocker: {item}</div>)}</div>
          </div>
        </div>
      </GlassCard>
    </Panel>
  );
}

function DLQTriageView({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="05 / Error & DLQ Triage">
      <div className="grid gap-3 lg:grid-cols-3">
        {dlqItems.map(([company, reason, detail]) => (
          <GlassCard key={company}>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-950">{company}</div>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <GlassCard density="compact" variant="muted" className="mt-3 rounded-[18px] bg-slate-900/10">
              <BrowserPreview>
                <div className="space-y-2">
                  <div className="h-3 w-2/3 rounded-full bg-white/50" />
                  <div className="h-8 rounded-[12px] border border-red-400/30 bg-red-400/10" />
                  <div className="h-3 w-1/2 rounded-full bg-white/40" />
                </div>
              </BrowserPreview>
            </GlassCard>
            <div className="mt-3 text-sm font-semibold text-red-600">{reason}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
              <Button size="sm" variant="success"><Check className="h-3.5 w-3.5" /> Resolve</Button>
              <Button size="sm" variant="secondary"><SkipForward className="h-3.5 w-3.5" /> Skip</Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </Panel>
  );
}

function ReasoningTrace({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="06 / Agent Reasoning Trace">
      <GlassCard>
        <EventLog events={eventLogItems} />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {["scrape.greenhouse", "match.role", "write.cover"].map((item) => (
            <span key={item} className="rounded-full border border-white/65 bg-white/32 px-3 py-2 font-mono text-xs text-slate-600">{item}</span>
          ))}
        </div>
      </GlassCard>
    </Panel>
  );
}

function PersonaSettingsEditor({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="07 / Settings & Persona Editor">
      <div className="grid gap-4 xl:grid-cols-4">
        {[
          ["Target roles", personaSettings.targets],
          ["Locations", personaSettings.locations],
          ["Company blocklist", personaSettings.blocked],
          ["Resume variants", personaSettings.variants],
        ].map(([label, items]) => (
          <GlassCard key={label as string}>
            <div className="mb-3 text-sm font-semibold text-slate-950">{label as string}</div>
            <div className="flex flex-wrap gap-2">{(items as string[]).map((item) => <GlassTag key={item} variantKey={variantKey} label={item} tone="neutral" />)}</div>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="mt-4">
        <div className="mb-3 text-sm font-semibold text-slate-950">Cover letter voice</div>
        <div className="grid gap-3 md:grid-cols-3">
          {["Concise", "Product-minded", "Technical proof"].map((item, index) => (
            <div key={item} className="flex items-center justify-between rounded-full border border-white/65 bg-white/34 px-4 py-2 text-sm font-semibold text-slate-700">
              {item}<span className="h-5 w-9 rounded-full" style={{ backgroundColor: index === 1 ? v.accent : "rgba(100,116,139,0.18)" }} />
            </div>
          ))}
        </div>
      </GlassCard>
    </Panel>
  );
}

function NotificationsCenter({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="08 / Notifications Center">
      <div className="grid gap-3 lg:grid-cols-3">
        {notifications.map(([kind, text, channel]) => (
          <GlassCard key={text}>
            <div className="flex items-center justify-between">
              <Pill variantKey={variantKey} tone={kind === "Blocker" ? "danger" : kind === "Interview" ? "success" : "accent"}>{kind}</Pill>
              <Bell className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-4 text-sm font-semibold leading-6 text-slate-800">{text}</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> {channel}</div>
          </GlassCard>
        ))}
      </div>
    </Panel>
  );
}

function AnalyticsFunnel({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="09 / Analytics & Funnel View">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr_0.8fr]">
        <GlassCard>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><BarChart3 className="h-4 w-4 text-slate-500" /> Provider conversion</div>
          <table className="w-full text-sm">
            <tbody>{analyticsRows.map(([provider, stage, count, rate]) => (
              <tr key={provider} className="border-b border-white/40 last:border-0">
                <td className="py-2 font-semibold text-slate-900">{provider}</td><td className="py-2 text-slate-500">{stage}</td><td className="py-2 font-mono">{count}</td><td className="py-2 font-mono text-slate-700">{rate}</td>
              </tr>
            ))}</tbody>
          </table>
        </GlassCard>
        <GlassCard>
          <div className="mb-3 text-sm font-semibold text-slate-950">Response time histogram</div>
          <div className="flex h-28 items-end gap-2">{[34, 56, 78, 52, 36, 22, 14].map((height, index) => <div key={index} className="flex-1 rounded-t-full" style={{ height: `${height}%`, background: `linear-gradient(180deg, ${v.accent}, rgba(14,165,233,0.16))` }} />)}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-semibold text-slate-950">What&apos;s working</div>
          <div className="mt-4 font-mono text-3xl text-slate-950">AI Product</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">Best resume variant by interview conversion.</div>
          <MiniMeter value={82} color={v.success} />
        </GlassCard>
      </div>
    </Panel>
  );
}

function OnboardingFirstRun({ variantKey }: { variantKey: VariantKey }) {
  const steps = [["Upload resume", UploadCloud], ["Confirm persona", CheckCircle2], ["Connect providers", PlugZap], ["Dry run", Eye]] as const;

  return (
    <Panel variantKey={variantKey} title="10 / Onboarding & First Run">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map(([label, Icon], index) => (
          <GlassCard key={label}>
            <Icon className={cx("h-5 w-5", index < 2 ? "text-emerald-600" : "text-slate-500")} />
            <div className="mt-4 text-sm font-semibold text-slate-950">{label}</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">{index < 2 ? "Complete" : "Ready to configure"}</div>
          </GlassCard>
        ))}
      </div>
    </Panel>
  );
}

function LiveRunViewer({ variantKey }: { variantKey: VariantKey }) {
  return (
    <Panel variantKey={variantKey} title="11 / Session & Live Run Viewer">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard>
          <BrowserPreview>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[16px] border border-white/50 bg-white/30 px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Linear</div>
                  <div className="text-xs text-slate-500">Senior Product Manager</div>
                </div>
                <Pill variantKey={variantKey} tone="active">autofill</Pill>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-10 rounded-[14px] border border-sky-400/35 bg-sky-400/10" />
                <div className="h-10 rounded-[14px] border border-white/50 bg-white/30" />
                <div className="h-10 rounded-[14px] border border-white/50 bg-white/30" />
                <div className="h-10 rounded-[14px] border border-emerald-400/30 bg-emerald-400/10" />
              </div>
              <div className="h-16 rounded-[16px] border border-white/45 bg-white/24" />
            </div>
          </BrowserPreview>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary"><Pause className="h-3.5 w-3.5" /> Pause</Button>
            <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /> Intervene</Button>
            <Button size="sm" variant="danger"><Ban className="h-3.5 w-3.5" /> Abort</Button>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="mb-3 text-sm font-semibold text-slate-950">Action log</div>
          <EventLog events={eventLogItems} compact />
        </GlassCard>
      </div>
    </Panel>
  );
}

function AuditLog({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <Panel variantKey={variantKey} title="12 / Audit Log">
      <div className={cx("overflow-x-auto border", v.radius, v.panelAlt)}>
        <div className="flex items-center justify-between border-b border-white/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardList className="h-4 w-4 text-slate-500" /> Immutable submissions</div>
          <Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <tbody>{auditRows.map(([time, company, role, provider, status]) => (
            <tr key={`${time}-${company}`} className="border-b border-white/40 last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{time}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">{company}</td>
              <td className="px-4 py-3 text-slate-600">{role}</td>
              <td className="px-4 py-3 text-slate-500">{provider}</td>
              <td className="px-4 py-3"><Pill variantKey={variantKey} tone={status === "submitted" ? "success" : "warning"}>{status}</Pill></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function OperationalComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="space-y-5">
      <GallerySectionHeader
        kicker="01 / Operator"
        title="Core Operator Components"
        description="The primary control surfaces for running, pausing, inspecting, and proving autonomous application work."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <AgentControlPanel variantKey={variantKey} />
        <LiveRunViewer variantKey={variantKey} />
      </div>
      <ReasoningTrace variantKey={variantKey} />
      <AuditLog variantKey={variantKey} />

      <GallerySectionHeader
        kicker="02 / Approval"
        title="Human Approval Components"
        description="Review, approve, reject, or recover the moments where the agent needs human judgment."
      />
      <ApprovalQueue variantKey={variantKey} />
      <DocumentDiffViewer variantKey={variantKey} />
      <DLQTriageView variantKey={variantKey} />

      <GallerySectionHeader
        kicker="03 / Intelligence"
        title="Job Intelligence Components"
        description="Role context, match evidence, scraped signals, blockers, and the application detail card."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <RoleDetailDrawer variantKey={variantKey} />
        <ApplicationDetailGallery variantKey={variantKey} />
      </div>
      <MatchBreakdownGallery variantKey={variantKey} />

      <GallerySectionHeader
        kicker="04 / Personalization"
        title="Personalization Components"
        description="Persona, resume variants, voice controls, provider setup, and first-run readiness."
      />
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <PersonaSettingsEditor variantKey={variantKey} />
        <OnboardingFirstRun variantKey={variantKey} />
      </div>

      <GallerySectionHeader
        kicker="05 / Feedback"
        title="System Feedback Components"
        description="Notifications, status language, errors, empty states, and success confirmations."
      />
      <NotificationsCenter variantKey={variantKey} />
      <SystemStatesGallery variantKey={variantKey} />

      <GallerySectionHeader
        kicker="06 / Analytics"
        title="Analytics Components"
        description="Funnel health, provider conversion, response-time shape, and resume variant performance."
      />
      <AnalyticsFunnel variantKey={variantKey} />
    </section>
  );
}

function DashboardPageComponents({ variantKey }: { variantKey: VariantKey }) {
  const v = variants[variantKey];

  return (
    <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel variantKey={variantKey} title="Dashboard Components">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard variant="selected">
            <div className="flex items-center justify-between">
              <Pill variantKey={variantKey} tone="active">Ashby live</Pill>
              <span className="font-mono text-xs text-slate-500">RUN-A42</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-950">Active Ashby run card</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Direct URL flow is filling mapped questions, attaching the AI Product resume, and waiting on one human-safe answer.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["discovered", "mapped", "awaiting approval"].map((step, index) => (
                <div key={step} className="rounded-[16px] border border-white/55 bg-white/28 px-3 py-2 text-xs font-semibold text-slate-600">
                  <span className="mr-2 font-mono text-slate-400">0{index + 1}</span>{step}
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard>
            <div className="mb-3 text-sm font-semibold text-slate-950">Provider coverage matrix</div>
            <div className="space-y-2">
              {providerCoverage.map(([provider, status, tone, detail]) => (
                <div key={provider} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-900">{provider}</span>
                  <span className="text-slate-500">{detail}</span>
                  <Pill variantKey={variantKey} tone={tone as StatusTone}>{status}</Pill>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Demo-safe metric strip</div>
                <div className="mt-1 text-xs text-slate-500">Seeded and live data use the same component contract.</div>
              </div>
              <Pill variantKey={variantKey} tone="neutral">fallback ready</Pill>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["Applications", "23", v.accent],
                ["DLQ pending", "4", mistColors.warning],
                ["Cache reuse", "67.8%", v.accent2],
                ["Time saved", "18.5h", v.success],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-[18px] border border-white/45 bg-white/24 px-3 py-3">
                  <div className="text-xs font-semibold text-slate-500">{label}</div>
                  <div className="mt-2 font-mono text-2xl text-slate-950">{value}</div>
                  <MiniMeter value={label === "DLQ pending" ? 38 : 72} color={color} />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </Panel>
    </section>
  );
}

function ApplicationDetailPageComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel variantKey={variantKey} title="Application Detail Components">
        <div className="space-y-4">
          <GlassCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><Building2 className="h-5 w-5 text-slate-500" /> Ashby Systems</div>
                <div className="mt-1 text-sm text-slate-600">Product Engineer Intern · Ashby · direct application URL</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill variantKey={variantKey} tone="success">proof captured</Pill>
                <Pill variantKey={variantKey} tone="neutral">seed compatible</Pill>
              </div>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="mb-3 text-sm font-semibold text-slate-950">Question / answer map</div>
            <div className="space-y-2">
              {questionMapRows.map(([question, source, status, value]) => (
                <div key={question} className="grid grid-cols-[1fr_120px_92px] items-center gap-3 rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{question}</div>
                    <div className="text-xs text-slate-500">{value}</div>
                  </div>
                  <span className="text-xs text-slate-500">{source}</span>
                  <Pill variantKey={variantKey} tone={status === "blocked" ? "warning" : status === "locked" ? "locked" : "success"}>{status}</Pill>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </Panel>
      <Panel variantKey={variantKey} title="Artifact & Evidence Panels">
        <div className="grid gap-4 lg:grid-cols-2">
          <ArtifactCard title="AI Product resume" meta="PDF · 148 KB · 1 page" />
          <ArtifactCard title="Tailoring rationale" meta="3 edits · 5 locked fields" type="attachment" />
          <GlassCard className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-950">Browser evidence panel</div>
              <Pill variantKey={variantKey} tone="success">recorded</Pill>
            </div>
            <BrowserPreview>
              <div className="space-y-3">
                <div className="h-4 w-2/3 rounded-full bg-white/55" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="h-9 rounded-[12px] border border-white/45 bg-white/30" />
                  <div className="h-9 rounded-[12px] border border-emerald-400/30 bg-emerald-400/10" />
                </div>
                <div className="h-14 rounded-[14px] border border-sky-400/30 bg-sky-400/10" />
              </div>
            </BrowserPreview>
          </GlassCard>
        </div>
      </Panel>
    </section>
  );
}

function DLQCachePageComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Panel variantKey={variantKey} title="DLQ & Answer Cache Components">
        <div className="grid gap-4">
          <GlassCard variant="critical">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Pill variantKey={variantKey} tone="warning">human required</Pill>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">Work authorization question</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">The agent stopped because this answer should never be inferred from a resume.</p>
              </div>
              <TriangleAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="success">Approve answer</Button>
              <Button size="sm" variant="secondary">Edit</Button>
              <Button size="sm" variant="danger">Skip role</Button>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="mb-3 text-sm font-semibold text-slate-950">Cache impact preview</div>
            <div className="space-y-2">
              {cacheRows.map(([answer, className, impact]) => (
                <div key={answer} className="flex items-center justify-between gap-3 rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-900">{answer}</span>
                  <span className="text-xs text-slate-500">{className}</span>
                  <span className="font-mono text-xs text-slate-600">{impact}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </Panel>
      <Panel variantKey={variantKey} title="Answerability States">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Safe suggested answer", "Can be reused after approval", "success"],
            ["Sensitive legal answer", "Must be human-authored", "warning"],
            ["Unsupported gate", "Stop run and classify", "danger"],
            ["Known cache hit", "Reuse approved memory", "neutral"],
          ].map(([label, copy, tone]) => (
            <GlassCard key={label} density="compact">
              <Pill variantKey={variantKey} tone={tone as StatusTone}>{label}</Pill>
              <div className="mt-4 text-sm leading-6 text-slate-600">{copy}</div>
            </GlassCard>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function SettingsIntakePageComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Panel variantKey={variantKey} title="Settings & Intake Components">
        <GlassCard variant="selected">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-950">Intake readiness</div>
              <div className="mt-1 text-sm text-slate-600">Provider runs stay blocked until required truth is verified.</div>
            </div>
            <Pill variantKey={variantKey} tone="warning">87%</Pill>
          </div>
          <div className="mt-5 space-y-2">
            {intakeReadinessRows.map(([label, status, tone]) => (
              <div key={label} className="flex items-center justify-between rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-900">{label}</span>
                <Pill variantKey={variantKey} tone={tone as StatusTone}>{status}</Pill>
              </div>
            ))}
          </div>
        </GlassCard>
      </Panel>
      <Panel variantKey={variantKey} title="Policy & Truth Sections">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Candidate truth", ["Legal name", "Email", "Projects", "Proof points"]],
            ["Reusable answers", ["Portfolio URL", "GitHub", "Demo link", "Preferred location"]],
            ["Hard blocks", ["No commission-only", "No unsupported visa guess", "No defense"]],
          ].map(([title, items]) => (
            <GlassCard key={title as string}>
              <div className="mb-3 text-sm font-semibold text-slate-950">{title as string}</div>
              <div className="flex flex-wrap gap-2">{(items as string[]).map((item) => <GlassTag key={item} variantKey={variantKey} label={item} tone="neutral" />)}</div>
            </GlassCard>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ProviderProofPageComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Panel variantKey={variantKey} title="Provider Proof Components">
        <div className="grid gap-3">
          {proofRows.map(([label, tone, detail]) => (
            <GlassCard key={label} density="compact" variant={tone === "danger" ? "critical" : tone === "success" ? "selected" : "default"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pill variantKey={variantKey} tone={tone as StatusTone}>{label}</Pill>
                  <div className="mt-3 text-sm leading-6 text-slate-600">{detail}</div>
                </div>
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
            </GlassCard>
          ))}
        </div>
      </Panel>
      <Panel variantKey={variantKey} title="Run Grade Card">
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Ashby run grade</div>
              <div className="mt-3 font-mono text-5xl text-slate-950">A-</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Confirmed artifact upload, mapped required questions, and stopped safely on one human-only answer.</p>
            </div>
            <Pill variantKey={variantKey} tone="success">claim safe</Pill>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {["screenshot", "event log", "submit class"].map((item) => (
              <div key={item} className="rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-xs font-semibold text-slate-600">{item}</div>
            ))}
          </div>
        </GlassCard>
      </Panel>
    </section>
  );
}

function PricingPageComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel variantKey={variantKey} title="Pricing Components">
        <div className="grid gap-4 md:grid-cols-3">
          {pricingTiers.map(([tier, price, mode, limit], index) => (
            <GlassCard key={tier} variant={index === 2 ? "selected" : "default"}>
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-950">{tier}</div>
                {index === 2 && <Pill variantKey={variantKey} tone="active">demo CTA</Pill>}
              </div>
              <div className="mt-5 font-serif text-5xl text-slate-950">{price}</div>
              <div className="mt-3 text-sm font-semibold text-slate-700">{mode}</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">{limit}</div>
              <Button className="mt-5 w-full" variant={index === 2 ? "primary" : "secondary"}>Choose {tier}</Button>
            </GlassCard>
          ))}
        </div>
      </Panel>
      <Panel variantKey={variantKey} title="Checkout & Claim Components">
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-950">Checkout state card</div>
              <Pill variantKey={variantKey} tone="neutral">test mode</Pill>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Stripe can be live, fallback, or disabled without breaking the pricing page layout.</p>
          </GlassCard>
          <GlassCard>
            <div className="text-sm font-semibold text-slate-950">Human-in-loop vs autonomous compare</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[16px] border border-white/45 bg-white/24 p-3 text-slate-600">Manual approval for every submit</div>
              <div className="rounded-[16px] border border-sky-400/30 bg-sky-400/10 p-3 text-slate-700">Autonomous runs with safety stops</div>
            </div>
          </GlassCard>
        </div>
      </Panel>
    </section>
  );
}

function PageReadyComponents({ variantKey }: { variantKey: VariantKey }) {
  return (
    <section className="space-y-5">
      <GallerySectionHeader
        kicker="07 / Pages"
        title="Page-Ready Components"
        description="Composite building blocks mapped to the Linear MVP routes: dashboard, application detail, DLQ/cache, settings/intake, provider proof, and pricing."
      />
      <DashboardPageComponents variantKey={variantKey} />
      <ApplicationDetailPageComponents variantKey={variantKey} />
      <DLQCachePageComponents variantKey={variantKey} />
      <SettingsIntakePageComponents variantKey={variantKey} />
      <ProviderProofPageComponents variantKey={variantKey} />
      <PricingPageComponents variantKey={variantKey} />
    </section>
  );
}

export function VariationPage() {
  const variantKey: VariantKey = "lightMist";
  const v = variants[variantKey];

  return (
    <Shell variantKey={variantKey}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[6%] top-[10%] h-72 w-72 rounded-full bg-white/32 blur-3xl" />
        <div className="absolute right-[8%] top-[18%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${v.accent}18` }} />
        <div className="absolute bottom-[8%] left-[38%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${v.accent2}14` }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.45),transparent_24rem),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.22),transparent_28rem)]" />
      </div>
      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel variantKey={variantKey} title={v.eyebrow} className="min-h-[420px]">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="min-w-0">
              <Pill variantKey={variantKey}>autonomous job-search agent</Pill>
              <h1 className={cx("mt-8 max-w-[calc(100vw-5rem)] text-5xl font-light leading-[0.95] [overflow-wrap:anywhere] sm:max-w-xl sm:text-6xl", v.fontTitle, v.text)}>
                {v.title}
              </h1>
              <p className={cx("mt-6 max-w-[calc(100vw-5rem)] text-sm leading-6 [overflow-wrap:anywhere] sm:max-w-lg", v.muted)}>{v.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button variantKey={variantKey}>
                  Open live run <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variantKey={variantKey} secondary>
                  View artifacts <MonitorPlay className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {["23 applied", "6 interviews", "312 cache hits"].map((item) => (
                  <GlassCard key={item} density="compact" className="text-sm">{item}</GlassCard>
                ))}
              </div>
            </div>
            <HeroGraphic variantKey={variantKey} />
          </div>
        </Panel>

        <Panel variantKey={variantKey} title="Component Snapshot">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard>
              <div className="flex items-center justify-between">
                <span className={cx("text-sm font-semibold", v.text)}>Applications</span>
                <SendHorizontal className="h-4 w-4 text-sky-500" />
              </div>
              <div className={cx("mt-3 text-5xl", v.fontTitle)}>23</div>
              <div className={cx("mt-2 text-sm", v.muted)}>+7 this week</div>
              <Sparkline color={v.accent} />
            </GlassCard>
            <GlassCard>
              <div className="flex items-center justify-between">
                <span className={cx("text-sm font-semibold", v.text)}>Response</span>
                <Activity className="h-4 w-4 text-emerald-600" />
              </div>
              <div className={cx("mt-3 text-5xl", v.fontTitle)}>42%</div>
              <div className={cx("mt-2 text-sm", v.muted)}>+8% vs last 7 days</div>
              <Sparkline color={v.success} />
            </GlassCard>
            <GlassCard className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Pill variantKey={variantKey}>Applied</Pill>
                <Pill variantKey={variantKey} tone="success">Offer</Pill>
                <Pill variantKey={variantKey} tone="warning">Review</Pill>
                <Pill variantKey={variantKey} tone="danger">Blocked</Pill>
                <Pill variantKey={variantKey} tone="neutral">Saved</Pill>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variantKey={variantKey}>Primary</Button>
                <Button variantKey={variantKey} secondary>Secondary</Button>
              </div>
            </GlassCard>
          </div>
        </Panel>
      </section>

      <OperationalComponents variantKey={variantKey} />
      <PageReadyComponents variantKey={variantKey} />
      <GallerySectionHeader
        kicker="08 / Appendix"
        title="Primitive Appendix"
        description="Foundational controls, tags, forms, typography, and icon explorations used by the product components above."
      />
      <MistWorkbench variantKey={variantKey} />
      <CustomIconLab variantKey={variantKey} />
    </Shell>
  );
}
