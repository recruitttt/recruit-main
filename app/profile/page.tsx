//
// /profile — tri-mode (data | timeline | graph) profile dashboard.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §9
//
// This is a server component. It:
//   1. Reads the session via the existing better-auth bridge in lib/auth-server.
//   2. Redirects unauthenticated users to /sign-in. This route deliberately
//      lives outside app/(app) so it is not hidden by the onboarding cookie
//      gate after logout/re-login or cookie clearing.
//   3. Renders a sticky toggle (?view=data default | timeline | graph) and mounts
//      each view — the inactive one is hidden via
//      `display:none` so neither tears down its Convex subscriptions when
//      the user flips back and forth.
//

import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock3, Database, Network } from "lucide-react";

import { isAuthenticated } from "@/lib/auth-server";
import { DataView } from "@/components/profile/DataView";
import { GraphView } from "@/components/profile/GraphView";
import { TimelineView } from "@/components/profile/TimelineView";

import { cx, mistClasses } from "@/components/design-system";
import { PageTransition } from "@/components/page-transition";
import { Topnav } from "@/components/shell/topnav";
import { getSessionUser } from "./_session";
import { IntakeStatusRow } from "./_intake-status-row";

export const metadata = {
  title: "Profile · Recruit",
  description:
    "Dense data dashboard + interactive knowledge graph of everything Recruit knows about you.",
};

type ViewMode = "data" | "timeline" | "graph";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAuthenticated().catch(() => false))) {
    redirect("/sign-in");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    // The session resolved but no user id is present — bounce to sign-in
    // so we don't try to subscribe to `userProfiles.byUser({ userId: "" })`.
    redirect("/sign-in");
  }

  const params = (await searchParams) ?? {};
  const view = parseView(params["view"]);

  return (
    <div className={cx("flex min-h-screen flex-col", mistClasses.appSurface)}>
      <Topnav />
      <main className="flex-1">
        <PageTransition>
          <div className={cx(mistClasses.appSurface, "min-h-screen pb-12")}>
            <ViewToggle current={view} />

            {/* Both subtrees mounted so subscriptions survive a tab flip. */}
            <div hidden={view !== "data"}>
              <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 md:px-6">
                <IntakeStatusRow userId={sessionUser.id} />
              </div>
              <DataView
                userId={sessionUser.id}
                fallbackName={sessionUser.name ?? undefined}
                fallbackEmail={sessionUser.email ?? undefined}
                fallbackImage={sessionUser.image ?? undefined}
              />
            </div>
            <div hidden={view !== "timeline"}>
              <TimelineView userId={sessionUser.id} active={view === "timeline"} />
            </div>
            <div hidden={view !== "graph"}>
              <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-16 pt-6 md:px-6">
                <GraphView userId={sessionUser.id} active={view === "graph"} />
              </div>
            </div>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}

function parseView(raw: string | string[] | undefined): ViewMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "timeline") return "timeline";
  return v === "graph" ? "graph" : "data";
}

function ViewToggle({ current }: { current: ViewMode }): React.ReactElement {
  return (
    <div className="sticky top-[68px] z-20 flex justify-center px-4 pt-4">
      <div
        className={cx(
          "inline-flex items-center gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] p-1 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_38px_rgba(2,8,6,0.12)]",
        )}
        role="tablist"
        aria-label="Profile view mode"
      >
        <ToggleLink mode="data" current={current} icon={Database} label="Data view" />
        <ToggleLink mode="timeline" current={current} icon={Clock3} label="Timeline" />
        <ToggleLink mode="graph" current={current} icon={Network} label="Graph view" />
      </div>
    </div>
  );
}

function ToggleLink({
  mode,
  current,
  icon: Icon,
  label,
}: {
  mode: ViewMode;
  current: ViewMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}): React.ReactElement {
  const active = mode === current;
  return (
    <Link
      href={`/profile?view=${mode}`}
      role="tab"
      aria-selected={active}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition",
        active
          ? "border border-[var(--glass-border)] bg-[var(--nav-active-bg)] text-[var(--color-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
          : "border border-transparent text-[var(--color-fg-muted)] hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
