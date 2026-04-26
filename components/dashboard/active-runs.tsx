import { mockApplications } from "@/lib/mock-data";
import { CompanyLogo } from "@/components/ui/logo";
import { StageBadge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";

export function ActiveRuns() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
            Active runs
          </h3>
          <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
            {mockApplications.length} applications
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{animation: "pulse-soft 2s ease-in-out infinite"}} />
          3 live
        </span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {mockApplications.map((app) => (
          <div
            key={app.id}
            className="block px-5 py-4"
          >
            <div className="flex items-start gap-3.5">
              <CompanyLogo bg={app.logoBg} text={app.logoText} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-medium text-[var(--color-fg)] truncate">
                      {app.company}
                    </span>
                    <span className="text-[14px] text-[var(--color-fg-muted)] truncate">
                      {app.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StageBadge stage={app.stage} pulse />
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--color-fg-subtle)] font-mono">
                  <span>{app.location}</span>
                  <span>·</span>
                  <span>via {app.provider}</span>
                  {app.salaryRange && <><span>·</span><span>{app.salaryRange}</span></>}
                  <span>·</span>
                  <span className="text-[var(--color-fg-muted)]">
                    Match {app.matchScore}
                  </span>
                  <span className="ml-auto">
                    {formatRelative(app.lastEventAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
