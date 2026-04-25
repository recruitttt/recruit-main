"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CreditCard, LayoutDashboard, Sparkles, X } from "lucide-react";

import {
  ActionButton,
  GlassCard,
  Panel,
  StatusBadge,
  cx,
  mistClasses,
  mistColors,
} from "@/components/design-system";

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Try the agent on a handful of roles. No credit card.",
    cta: "Start free",
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
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const router = useRouter();

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
              <StatusBadge tone="neutral">mock checkout</StatusBadge>
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
          description="Each CTA opens the same mock Stripe flow. Close the modal to stay here, or continue to the dashboard."
          actions={<StatusBadge tone="neutral">{tiers.length} plans</StatusBadge>}
        >
          <div className="grid gap-5 md:grid-cols-3">
            {tiers.map((tier) => (
              <GlassCard
                key={tier.name}
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
                          Most popular
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
                  className="mt-5 w-full"
                  variant={tier.highlight ? "primary" : "secondary"}
                  onClick={() => setConfirmed(tier.name)}
                >
                  <CreditCard className="h-4 w-4" />
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
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500">
            <span>All plans · cancel anytime · no contract</span>
            <span>Checkout returns to /dashboard</span>
          </div>
        </Panel>
      </div>

      <AnimatePresence>
        {confirmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onClick={() => setConfirmed(null)}
          >
            <motion.div
              initial={{ y: 16, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <GlassCard density="spacious" variant="selected">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="neutral" variant="solid">
                    Stripe
                  </StatusBadge>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">test mode</span>
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{confirmed} plan</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This is a mockup. In the real product, Stripe Checkout would open here.
                </p>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <ActionButton variant="ghost" onClick={() => setConfirmed(null)}>
                    Close
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    onClick={() => {
                      setConfirmed(null);
                      router.push("/dashboard");
                    }}
                  >
                    Go to dashboard
                    <ArrowRight className="h-4 w-4" />
                  </ActionButton>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
