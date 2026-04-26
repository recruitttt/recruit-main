"use client";

import Link from "next/link";
import { Fragment, useRef, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Command,
  Download,
  FileText,
  Loader2,
  Lock,
  MessageSquareText,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Mark, Wordmark } from "@/components/ui/logo";
import {
  RecruitBrandLink,
  TopLine,
  topLinePillClass,
} from "@/components/shell/top-line";

const sectionContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const sectionItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const HERO_TITLE_WORDS = ["Apply", "to", "jobs", "without", "applying."];

const liveRuns = [
  { company: "Linear", role: "Design Engineer", state: "Submitting", score: 94 },
  { company: "Anthropic", role: "Product Engineer", state: "Tailoring", score: 91 },
  { company: "Vercel", role: "Frontend Engineer", state: "Reviewing", score: 88 },
];

const proof = [
  ["3", "agents active"],
  ["14", "fields mapped"],
  ["91", "tailor score"],
];

const steps = [
  {
    title: "Find roles",
    detail: "Scans Ashby boards and ranks openings against your profile.",
    icon: Search,
  },
  {
    title: "Tailor docs",
    detail: "Researches the role, rewrites your resume, and generates a PDF.",
    icon: FileText,
  },
  {
    title: "Ask before guessing",
    detail: "Sensitive questions stop in the queue until you approve them.",
    icon: ShieldCheck,
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    detail: "5 applications / month",
    features: ["Ashby coverage", "Resume tailoring", "Review queue"],
    cta: "Start free",
    href: "/onboarding",
    featured: false,
  },
  {
    name: "Standard",
    price: "$10",
    detail: "100 applications / month",
    features: ["Priority queue", "3-persona review", "Unlimited answer cache"],
    cta: "Start Standard",
    href: "/onboarding?tier=standard",
    featured: true,
  },
  {
    name: "Pro",
    price: "$20",
    detail: "Unlimited applications",
    features: ["Recruiter outreach", "Auto follow-ups", "Custom templates"],
    cta: "Start Pro",
    href: "/onboarding?tier=pro",
    featured: false,
  },
];

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const viewport = { once: true, amount: 0.3 } as const;

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <TopLine
        variant="hero"
        maxWidthClassName="max-w-7xl"
        brand={<RecruitBrandLink variant="hero" ariaLabel="Recruit" />}
        nav={
          <nav className="ml-4 hidden items-center gap-2 text-[13px] font-medium text-white/85 md:flex [text-shadow:0_1px_2px_rgba(15,23,42,0.18)]">
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
          </nav>
        }
        actions={
          <>
            <Link href="/dashboard" className={`${topLinePillClass("hero")} hidden sm:inline-flex`}>
              Sign in
            </Link>
            <Link href="/onboarding">
              <Button size="sm" className="h-10 rounded-full bg-[var(--color-accent)] px-4 text-white hover:brightness-110">
                Start applying
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </>
        }
      />

      {/* ====== HERO ANIMATIONS BELOW (DO NOT MODIFY) ====== */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[78svh] overflow-hidden"
          style={{
            backgroundImage: "url(/landing-hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "center 85%",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_22%,rgba(255,255,255,0)_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[16%] bg-[linear-gradient(to_bottom,rgba(245,248,241,0)_0%,#F5F8F1_100%)]" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col px-4 pb-8 pt-20 sm:px-6 sm:pt-24 lg:pt-28">
          <div className="mx-auto max-w-5xl space-y-6 text-center">
            <h1 className="mx-auto max-w-4xl text-balance font-serif text-[clamp(32px,5.6vw,72px)] leading-[0.96] tracking-tight text-slate-950">
              {HERO_TITLE_WORDS.map((word, index) => (
                <Fragment key={`${word}-${index}`}>
                  <span
                    className="inline-block"
                    style={{ perspective: "900px" }}
                  >
                    <span
                      className="inline-block will-change-transform"
                      style={{
                        transformOrigin: "50% 90%",
                        animation: `word-flip-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${0.25 + index * 0.12}s both`,
                      }}
                    >
                      {word}
                    </span>
                  </span>
                  {index < HERO_TITLE_WORDS.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h1>
            <p
              className="mx-auto max-w-xl text-balance text-[13px] leading-5 text-slate-600 sm:text-[14px]"
              style={{
                animation: "hero-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) 1.35s both",
              }}
            >
              Recruit finds roles, researches each company, tailors your resume, and pauses only when it needs your truth.
            </p>

            <div
              className="flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={{
                animation: "hero-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.6s both",
              }}
            >
              <Link href="/onboarding" className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.03]">
                <Button size="lg" className="h-12 rounded-full bg-[var(--color-accent)] px-6 text-white hover:brightness-110">
                  Spin up my agents
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard" className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.02]">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 rounded-full border-white/70 bg-white/58 px-6 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_34px_rgba(15,23,42,0.06)] hover:bg-white/75"
                >
                  View live dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="relative mx-auto mt-10 w-full max-w-4xl flex-1"
            style={{
              animation: "hero-rise 0.95s cubic-bezier(0.22, 1, 0.36, 1) 1.9s both",
            }}
          >
            <ProductMockup />
          </div>
        </div>
      </section>

      {/* ====== END HERO ANIMATIONS ====== */}

      <section className="bg-[var(--color-bg)] px-4 py-16 sm:px-6">
        <motion.div
          className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3"
          variants={reduceMotion ? undefined : sectionContainer}
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={viewport}
        >
          {steps.map((step) => (
            <motion.div
              key={step.title}
              variants={reduceMotion ? undefined : sectionItem}
              className="rounded-[28px] border border-white/70 bg-white/68 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/78 text-[var(--color-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <step.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            viewport={viewport}
          >
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Simple pricing</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Start free, then scale only when the agent is doing real work.</p>
            </div>
            <div className="text-sm font-medium text-slate-500">Cancel anytime</div>
          </motion.div>

          <motion.div
            className="mt-5 grid gap-3 lg:grid-cols-3"
            style={{ perspective: "1100px" }}
            variants={reduceMotion ? undefined : sectionContainer}
            initial={reduceMotion ? false : "hidden"}
            whileInView={reduceMotion ? undefined : "visible"}
            viewport={viewport}
          >
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={reduceMotion ? undefined : sectionItem}
                className="min-w-0"
              >
              <TiltCard
                className={`min-w-0 rounded-[22px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_36px_rgba(15,23,42,0.05)] ${
                  plan.featured
                    ? "border-[var(--color-accent)] bg-white/82"
                    : "border-white/70 bg-white/58"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{plan.name}</div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold tracking-tight text-slate-950">{plan.price}</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">/ mo</span>
                    </div>
                  </div>
                  {plan.featured ? (
                    <span className="rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                      Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-slate-600">{plan.detail}</div>
                <div className="mt-4 grid gap-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Link href={plan.href} className="mt-4 block">
                  <Button
                    size="sm"
                    variant={plan.featured ? "primary" : "secondary"}
                    className={`w-full rounded-full ${
                      plan.featured
                        ? "bg-[var(--color-accent)] text-white hover:brightness-110"
                        : "border-white/70 bg-white/58 text-slate-700 hover:bg-white/75"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <motion.footer
        className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 sm:px-6"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        viewport={viewport}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <div className="flex gap-5">
            <Link href="/dashboard" className="transition hover:text-slate-950">Dashboard</Link>
            <Link href="/onboarding" className="transition hover:text-slate-950">Start</Link>
          </div>
        </div>
      </motion.footer>
    </main>
  );
}

function ProductMockup() {
  return (
    <div className="relative">
      <div className="absolute left-1/2 top-8 h-[86%] w-[88%] -translate-x-1/2 rounded-[42px] bg-slate-950/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
        <div className="flex items-center gap-2 border-b border-white/55 bg-white/55 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="mx-auto hidden h-8 w-[360px] items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 text-[12px] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] md:flex">
            <Lock className="h-3.5 w-3.5" />
            recruit.app/dashboard/live-run
          </div>
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-white/75 bg-white/65 px-3 text-[12px] font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            live
          </div>
        </div>

        <div className="grid min-h-[520px] gap-px bg-white/45 md:grid-cols-[220px_1fr_330px]">
          <aside className="hidden bg-white/45 p-4 md:block">
            <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/65 p-2">
              <Mark size="sm" className="text-[var(--color-accent)]" />
              <div>
                <div className="text-[13px] font-semibold text-slate-950">Recruit</div>
                <div className="text-[11px] text-slate-500">command center</div>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-[13px]">
              {["Dashboard", "Applications", "Artifacts", "Review queue"].map((item, index) => (
                <div
                  key={item}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 ${
                    index === 0
                      ? "border border-white/80 bg-white/76 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                      : "text-slate-500"
                  }`}
                >
                  <span>{item}</span>
                  {index === 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                </div>
              ))}
            </div>
          </aside>

          <section className="bg-white/35 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Live run
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  5 agents applying for Mo
                </h2>
              </div>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 text-[13px] font-semibold text-white">
                <Command className="h-3.5 w-3.5" />
                Assist
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {proof.map(([value, label]) => (
                <div key={label} className="rounded-[22px] border border-white/70 bg-white/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="font-mono text-3xl text-slate-950">{value}</div>
                  <div className="mt-1 text-[12px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[26px] border border-white/70 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex items-center justify-between border-b border-white/65 px-4 py-3">
                <div className="text-[13px] font-semibold text-slate-950">Application pipeline</div>
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" />
                  syncing
                </div>
              </div>
              <div className="divide-y divide-white/65">
                {liveRuns.map((run) => (
                  <div key={run.company} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 sm:grid-cols-[1fr_130px_70px] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-slate-950">{run.company}</div>
                      <div className="mt-1 truncate text-[12px] text-slate-500">{run.role}</div>
                    </div>
                    <div className="hidden rounded-full border border-white/75 bg-white/64 px-3 py-1 text-center text-[12px] font-semibold text-[var(--color-accent)] sm:block">
                      {run.state}
                    </div>
                    <div className="font-mono text-[18px] text-slate-950">{run.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="bg-white/48 p-4 sm:p-5">
            <div className="rounded-[26px] border border-white/75 bg-[#102016] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">Scout</div>
                <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  active
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-6 text-white/88">
                I found three strong roles. Linear is ready to submit after your work authorization answer.
              </p>
              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/8 p-3">
                <div className="flex items-center gap-2 text-[12px] text-white/64">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Human gate
                </div>
                <div className="mt-2 text-[13px] leading-5 text-white/86">
                  Are you legally authorized to work in the United States?
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <MiniArtifact icon={FileText} title="Resume tailored" detail="PDF ready for Anthropic" />
              <MiniArtifact icon={Check} title="Answers cached" detail="12 fields reused safely" />
              <MiniArtifact icon={Download} title="Artifact saved" detail="Ranking proof attached" />
            </div>

            <div className="mt-4 rounded-[24px] border border-white/70 bg-white/64 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Next action
              </div>
              <div className="mt-2 text-[14px] font-semibold text-slate-950">
                Approve one answer, then Scout submits.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MiniArtifact({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/64 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-950">{title}</div>
        <div className="mt-0.5 truncate text-[12px] text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  function applyTilt(rotX: number, rotY: number, hover: boolean) {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
    el.style.boxShadow = hover
      ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 28px 60px -18px rgba(15,23,42,0.18)"
      : "inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 36px rgba(15,23,42,0.05)";
  }

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (event.clientX - cx) / (rect.width / 2);
    const dy = (event.clientY - cy) / (rect.height / 2);
    const rotY = Math.max(-1, Math.min(1, dx)) * 8;
    const rotX = Math.max(-1, Math.min(1, dy)) * -8;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => applyTilt(rotX, rotY, true));
  }

  function handleLeave() {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    applyTilt(0, 0, false);
  }

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transformStyle: "preserve-3d",
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease-out",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
