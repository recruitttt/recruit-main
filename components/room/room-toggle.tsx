"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Top-right toggle that swaps between the 3D room (/dashboard) and the
// 2D mission-control dashboard (/dashboard/2d). Hidden on every page that
// isn't one of those two so it doesn't pollute settings, dlq, etc.
export function RoomToggle() {
  const pathname = usePathname();
  if (!pathname) return null;

  const isRoom = pathname === "/dashboard";
  const is2D = pathname.startsWith("/dashboard/2d");
  if (!isRoom && !is2D) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
      <ToggleLink
        href="/dashboard"
        active={isRoom}
        icon={<Box className="h-3 w-3" />}
        label="3D"
      />
      <ToggleLink
        href="/dashboard/2d"
        active={is2D}
        icon={<LayoutDashboard className="h-3 w-3" />}
        label="2D"
      />
    </div>
  );
}

function ToggleLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-mono uppercase tracking-[0.12em] transition-colors",
        active
          ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
          : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );
}
