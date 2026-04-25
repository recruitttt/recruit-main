"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, X as XClose } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Try the agent on a handful of roles. No credit card.",
    cta: "Start free",
    features: [
      "5 applications / month",
      "Ashby coverage",
      "Resume tailoring",
      "DLQ + answer cache",
      "Standard support",
    ],
    notIncluded: ["Recruiter outreach", "Priority queue"],
    highlight: false,
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
  },
];

export default function PricingPage() {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link href="/">
            <Wordmark />
          </Link>
          <Link href="/dashboard" className="ml-auto">
            <Button variant="secondary" size="sm">
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl w-full px-6 py-20">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none -z-0" />

        <div className="relative text-center mb-14 max-w-2xl mx-auto">
          <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
            Pricing
          </div>
          <h1 className="font-serif text-[56px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
            Pay for the agent,
            <br />
            <span className="text-[var(--color-fg-subtle)] italic">not the time.</span>
          </h1>
          <p className="mt-5 text-[16px] text-[var(--color-fg-muted)] max-w-md mx-auto">
            Start free. Upgrade when you want more applications, recruiter outreach, or full autonomy.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-xl border p-7 flex flex-col transition-colors",
                tier.highlight
                  ? "border-[var(--color-accent)] bg-[var(--color-surface)] shadow-[0_30px_80px_-20px_rgba(34,211,238,0.25)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              )}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--color-bg)] font-medium">
                  Most popular
                </div>
              )}

              <div>
                <h3 className="font-serif text-[26px] tracking-tight text-[var(--color-fg)]">
                  {tier.name}
                </h3>
                <p className="mt-1.5 text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
                  {tier.description}
                </p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-[48px] tracking-tight text-[var(--color-fg)] leading-none">
                  {tier.price}
                </span>
                <span className="text-[13px] text-[var(--color-fg-subtle)] font-mono">
                  {tier.cadence}
                </span>
              </div>

              <Button
                variant={tier.highlight ? "accent" : "secondary"}
                size="lg"
                className="mt-6 w-full"
                onClick={() => setConfirmed(tier.name)}
              >
                {tier.cta}
              </Button>

              <div className="mt-7 space-y-2.5">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px]">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" strokeWidth={2.5} />
                    <span className="text-[var(--color-fg-muted)]">{f}</span>
                  </div>
                ))}
                {tier.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px]">
                    <XClose className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-fg-subtle)]" />
                    <span className="text-[var(--color-fg-subtle)] line-through">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-14 text-center text-[12px] text-[var(--color-fg-subtle)] font-mono">
          All plans · cancel anytime · no contract
        </div>
      </main>

      {/* fake stripe modal */}
      <AnimatePresence>
        {confirmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setConfirmed(null)}
          >
            <motion.div
              initial={{ y: 16, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="rounded bg-[var(--color-fg)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--color-bg)]">
                  Stripe
                </span>
                <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                  test mode
                </span>
              </div>
              <h3 className="font-serif text-[28px] tracking-tight text-[var(--color-fg)]">
                {confirmed} plan
              </h3>
              <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">
                This is a mockup. In the real product, Stripe Checkout would open here.
              </p>
              <div className="mt-6 flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setConfirmed(null)}>
                  Close
                </Button>
                <Link href="/dashboard" onClick={() => setConfirmed(null)}>
                  <Button variant="primary">
                    Go to dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
