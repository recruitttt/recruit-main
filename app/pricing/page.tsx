"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Loader2, X as XClose } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    key: "free",
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
    key: "standard",
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
    key: "pro",
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
] as const;

export default function PricingPage() {
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(tier: (typeof tiers)[number]) {
    setError(null);

    if (tier.key === "free") {
      router.push("/onboarding");
      return;
    }

    setLoadingTier(tier.key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.key }),
      });
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.message ?? "Stripe sandbox checkout is unavailable.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadingTier(null);
    }
  }

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
            Pricing · Stripe sandbox
          </div>
          <h1 className="font-serif text-[56px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
            Pay for the agent,
            <br />
            <span className="text-[var(--color-fg-subtle)] italic">not the time.</span>
          </h1>
          <p className="mt-5 text-[16px] text-[var(--color-fg-muted)] max-w-md mx-auto">
            Start free. Upgrade in Stripe test mode when you want more applications,
            priority runs, or full autonomy.
          </p>
          {error && (
            <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-[12px] leading-relaxed text-amber-800">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em]">
                Sandbox checkout unavailable
              </div>
              <div className="mt-1">{error}</div>
            </div>
          )}
        </div>

        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-xl border p-7 flex flex-col transition-colors",
                tier.highlight
                  ? "border-[var(--color-accent)] bg-[var(--color-surface)] shadow-[0_20px_60px_-20px_rgba(8,145,178,0.28)]"
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
                disabled={loadingTier !== null}
                onClick={() => void handleCheckout(tier)}
              >
                {loadingTier === tier.key && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
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
          Stripe sandbox only · no live payment · cancel anytime
        </div>
      </main>
    </div>
  );
}
