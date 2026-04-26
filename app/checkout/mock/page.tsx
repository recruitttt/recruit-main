import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard } from "lucide-react";

import { GlassCard, Panel, StatusBadge, cx, mistClasses } from "@/components/design-system";

const allowedPlans = new Set(["Standard", "Pro"]);

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[]; amount?: string | string[] }>;
}) {
  const params = await searchParams;
  const plan = allowedPlans.has(valueOf(params.plan) ?? "") ? valueOf(params.plan) : "Standard";
  const amountCents = Number(valueOf(params.amount) ?? "2400");
  const price = Number.isFinite(amountCents) ? `$${(amountCents / 100).toFixed(0)}` : "$24";

  return (
    <main className={cx("min-h-screen px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-3xl items-center">
        <Panel
          title="Mock checkout"
          description="Proof-of-concept checkout is enabled. No card is collected and no billing is created."
          actions={<StatusBadge tone="warning">demo only</StatusBadge>}
        >
          <GlassCard className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <StatusBadge tone="accent">Recruit {plan}</StatusBadge>
                <h1 className="mt-4 text-3xl font-semibold text-slate-950">{price} / month</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This page stands in for Stripe Checkout until the real `sk_test_...` key is set in Vercel.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              <CheckCircle2 className="mr-2 inline h-4 w-4 align-[-3px]" />
              Completing this proof checkout returns to the same success URL as Stripe test mode.
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard?checkout=success&checkout_mode=mock"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[24px] border border-[#0F172A] bg-[#0F172A] px-4 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition"
              >
                Complete proof checkout
                <CheckCircle2 className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing?checkout=cancelled"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 text-sm font-semibold text-slate-700 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to pricing
              </Link>
            </div>
          </GlassCard>
        </Panel>
      </div>
    </main>
  );
}
