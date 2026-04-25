"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Check, CreditCard, LayoutDashboard, Loader2, Sparkles, X } from "lucide-react";

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

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Try the agent on a handful of roles. No credit card.",
    cta: "Start free",
    checkoutTier: null,
    features: ["5 applications / month", "Ashby coverage", "Resume tailoring", "DLQ + answer cache", "Standard support"],
    notIncluded: ["Recruiter outreach", "Priority queue"],
    highlight: false,
    tone: "neutral" as const,
  },
  {
    name: "Standard",
    price: "$24",
    cadence: "/ month",
    description: "For active job seekers who want real momentum.",
    cta: "Upgrade to Standard",
    checkoutTier: "standard",
    features: [
      "100 applications / month",
      "All providers as they ship",
      "3-persona resume review",
      "DLQ + cache (unlimited)",
      "Priority queue",
      "Email support",
    ],
    notIncluded: ["Recruiter outreach"],
    highlight: true,
    tone: "accent" as const,
  },
  {
    name: "Pro",
    price: "$79",
    cadence: "/ month",
    description: "Full autonomy. Recruiter outreach. White-glove support.",
    cta: "Go Pro",
    checkoutTier: "pro",
    features: [
      "Unlimited applications",
      "Recruiter outreach via Gmail",
      "Auto follow-ups",
      "Custom resume templates",
      "API access",
      "Dedicated Slack channel",
    ],
    notIncluded: [],
    highlight: false,
    tone: "success" as const,
  },
] as const;

export default function PricingPage() {
  const [checkout, setCheckout] = useState<{ tier?: string; error?: string; loading?: boolean }>({});
  const router = useRouter();

  async function startCheckout(tier: typeof tiers[number]) {
    if (!tier.checkoutTier) {
      router.push("/onboarding");
      return;
    }

    try {
      setCheckout({ tier: tier.name, loading: true });
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.checkoutTier }),
      });
      const body = await response.json().catch(() => null) as { url?: string; message?: string } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.message ?? "Checkout is not available right now.");
      }
      window.location.assign(body.url);
    } catch (err) {
      setCheckout({
        tier: tier.name,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <main className={cx("min-h-screen overflow-x-hidden px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[6%] top-[9%] h-72 w-72 rounded-full bg-white/32 blur-3xl" />
        <div className="absolute right-[8%] top-[16%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${mistColors.accent}16` }} />
        <div className="absolute bottom-[4%] left-[36%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${mistColors.neutral}12` }} />
      </div>

      <div className="relative mx-auto flex min-w-0 max-w-[1520px] flex-col gap-5">
        <Panel
          title="Pricing configuration"
          description="Public plan ladder and checkout handoff rendered in the same Glass/Mist surface as the dashboard."
          actions={
            <>
              <StatusBadge tone="success">live</StatusBadge>
              <StatusBadge tone="neutral">Stripe sandbox</StatusBadge>
              <ActionButton size="sm" variant="secondary" onClick={() => router.push("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </ActionButton>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="accent">client component</StatusBadge>
            <StatusBadge tone="neutral">3 tiers</StatusBadge>
            <StatusBadge tone="warning">Stripe modal is mocked</StatusBadge>
          </div>
        </Panel>

        <Panel
          title="Plan ladder"
            description="Free starts onboarding. Paid plans hand off to Stripe Checkout when sandbox credentials are configured."
          actions={<StatusBadge tone="neutral">{tiers.length} plans</StatusBadge>}
        >
          <div className="grid gap-5 md:grid-cols-3">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "min-w-0 motion-safe:transition-transform motion-safe:duration-200",
                  "motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_24px_56px_-32px_rgba(15,23,42,0.22)]",
                )}
              >
                <GlassCard
                  variant={tier.highlight ? "selected" : "default"}
                  className="flex h-full flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={tier.tone}>{tier.name}</StatusBadge>
                        {tier.highlight && (
                          <StatusBadge tone="accent" variant="solid">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 [background-size:200%_100%] motion-safe:animate-[shimmer_2.4s_linear_infinite]">
                              Most popular
                            </span>
                          </StatusBadge>
                        )}
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-slate-950">{tier.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-[-0.03em] text-slate-950">{tier.price}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{tier.cadence}</span>
                  </div>

                  <ActionButton
                    className="mt-5 w-full motion-safe:transition-transform motion-safe:hover:-translate-y-px motion-safe:active:scale-[0.98]"
                    variant={tier.highlight ? "primary" : "secondary"}
                    onClick={() => void startCheckout(tier)}
                    disabled={checkout.loading}
                  >
                    {checkout.loading && checkout.tier === tier.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {tier.cta}
                  </ActionButton>

                  <div className="mt-5 space-y-2.5">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
                        <span className="text-slate-600">{feature}</span>
                      </div>
                    ))}
                    {tier.notIncluded.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 text-sm">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-slate-400 line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500">
            <span>All plans · cancel anytime · no contract</span>
            <span>Checkout returns to /dashboard</span>
          </div>
          {checkout.error && (
            <div className="mt-4 rounded-[18px] border border-amber-300/55 bg-amber-50/55 px-4 py-3 text-sm leading-6 text-amber-800">
              {checkout.error}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
