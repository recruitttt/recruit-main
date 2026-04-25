import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo";

export default function PricingSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-5 font-serif text-[34px] leading-tight text-[var(--color-fg)]">
          Sandbox checkout complete
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          Stripe returned a successful test-mode checkout session. No live
          payment was processed.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex">
          <Button variant="primary">
            Go to dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </main>
  );
}
