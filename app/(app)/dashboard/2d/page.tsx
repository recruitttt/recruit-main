import Link from "next/link";
import { KPIStrip } from "@/components/dashboard/kpi-strip";
import { ActiveRuns } from "@/components/dashboard/active-runs";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Pipeline } from "@/components/dashboard/pipeline";
import { ProviderCoverage } from "@/components/dashboard/provider-coverage";
import { TailorRunList } from "@/components/dashboard/tailor-run-list";
import { mockDLQItems } from "@/lib/mock-data";
import { AlertTriangle, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const dlqCount = mockDLQItems.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* page header */}
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-tight tracking-tight text-[var(--color-fg)]">
            Mission control
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
            Your agent is live. Here's what it's doing right now.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-1 pl-2 pr-3 text-[11px] font-mono">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60" style={{animation: "pulse-soft 1.6s ease-in-out infinite"}} />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-emerald-700 uppercase tracking-[0.15em] text-[10px]">Agent live</span>
          </span>
        </div>
      </div>

      {/* DLQ banner */}
      {dlqCount > 0 && (
        <Link
          href="/dlq"
          className="group mb-6 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-3.5 transition-colors hover:border-amber-500/60 hover:bg-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <div>
              <span className="text-[13px] text-[var(--color-fg)]">
                {dlqCount} application{dlqCount === 1 ? "" : "s"} need your input
              </span>
              <span className="ml-2 text-[12px] text-[var(--color-fg-muted)]">
                Each answer caches for every future application
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-amber-700 group-hover:translate-x-0.5 transition-transform">
            Review DLQ <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      )}

      {/* KPIs */}
      <div className="mb-6">
        <KPIStrip />
      </div>

      {/* secondary row: pipeline + provider coverage */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Pipeline />
        </div>
        <ProviderCoverage />
      </div>

      {/* main row: active runs + activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveRuns />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>

      {/* Tailor pipeline: research → tailor → PDF, sequential, 10 jobs */}
      <div className="mt-6">
        <TailorRunList />
      </div>
    </div>
  );
}
