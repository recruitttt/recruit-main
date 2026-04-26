//
// /profile — dual-mode (data | graph) profile dashboard.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §9
//
// This is a server component. It:
//   1. Reads the session via the existing better-auth bridge in lib/auth-server.
//   2. Redirects unauthenticated users to /sign-in (the (app) layout would
//      also redirect, but doing it here too means we always have a userId
//      before mounting the client subscription components).
//   3. Renders a sticky toggle (?view=data default | ?view=graph) and mounts
//      BOTH <DataView /> and <GraphView /> — the inactive one is hidden via
//      `display:none` so neither tears down its Convex subscriptions when
//      the user flips back and forth.
//

import { redirect } from "next/navigation";
import Link from "next/link";
import { Database, Network } from "lucide-react";

import { isAuthenticated } from "@/lib/auth-server";
import { DataView } from "@/components/profile/DataView";
import { GraphView } from "@/components/profile/GraphView";

import { cx, mistClasses } from "@/components/design-system";
import { getSessionUser } from "./_session";

export const metadata = {
  title: "Profile · Recruit",
  description:
    "Dense data dashboard + interactive knowledge graph of everything Recruit knows about you.",
};

type ViewMode = "data" | "graph";

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
    <div className={cx("min-h-screen pb-12", mistClasses.page)}>
      <ViewToggle current={view} />

      {/* Both subtrees mounted so subscriptions survive a tab flip. */}
      <div hidden={view !== "data"}>
        <DataView
          userId={sessionUser.id}
          fallbackName={sessionUser.name ?? undefined}
          fallbackEmail={sessionUser.email ?? undefined}
          fallbackImage={sessionUser.image ?? undefined}
        />
      </div>
      <div hidden={view !== "graph"}>
        {/* GraphView reads its own session via authClient — no props. */}
        <GraphView />
      </div>
    </div>
  );
}

function parseView(raw: string | string[] | undefined): ViewMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "graph" ? "graph" : "data";
}

function ViewToggle({ current }: { current: ViewMode }): React.ReactElement {
  return (
    <div className="sticky top-[68px] z-20 flex justify-center px-4 pt-4">
      <div
        className={cx(
          "inline-flex items-center gap-1 rounded-full border bg-white/55 p-1 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_38px_rgba(15,23,42,0.10)]",
          "border-white/65",
        )}
        role="tablist"
        aria-label="Profile view mode"
      >
        <ToggleLink mode="data" current={current} icon={Database} label="Data view" />
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
          ? "border border-white/70 bg-white/85 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
          : "border border-transparent text-slate-600 hover:bg-white/45 hover:text-slate-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
