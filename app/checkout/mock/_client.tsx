"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowLeft, CheckCircle2, CreditCard } from "lucide-react";

import { GlassCard, Panel, StatusBadge } from "@/components/design-system";

const pageEnter: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
      delayChildren: 0.18,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function MockCheckoutContent({ plan, price }: { plan: string; price: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={reduceMotion ? undefined : pageEnter}
    >
      <Panel
        title="Mock checkout"
        description="Proof-of-concept checkout is enabled. No card is collected and no billing is created."
        actions={<StatusBadge tone="warning">demo only</StatusBadge>}
      >
        <GlassCard className="space-y-6">
          <motion.div
            className="flex items-start justify-between gap-4"
            variants={reduceMotion ? undefined : item}
          >
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
          </motion.div>

          <motion.div
            className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
            variants={reduceMotion ? undefined : item}
          >
            <CheckCircle2 className="mr-2 inline h-4 w-4 align-[-3px]" />
            Completing this proof checkout returns to the same success URL as Stripe test mode.
          </motion.div>

          <motion.div
            className="flex flex-wrap gap-3"
            variants={reduceMotion ? undefined : item}
          >
            <Link
              href="/dashboard?checkout=success&checkout_mode=mock"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[24px] border border-[#0F172A] bg-[#0F172A] px-4 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition hover:brightness-110"
            >
              Complete proof checkout
              <CheckCircle2 className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing?checkout=cancelled"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white/75"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to pricing
            </Link>
          </motion.div>
        </GlassCard>
      </Panel>
    </motion.div>
  );
}
