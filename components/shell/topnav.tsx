"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Mark } from "@/components/ui/logo";
import { cx, mistClasses, StatusBadge } from "@/components/design-system";
import { Box, LayoutGrid, Menu } from "lucide-react";
import { MobileNav, navItems } from "./mobile-nav";

export function Topnav() {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const showRoomToggle =
    pathname === "/dashboard" || pathname === "/dashboard/room";

  return (
    <header className="sticky top-0 z-30 border-b border-white/35 bg-[#CDD5DF]/78 px-2 py-3 text-[#101827] backdrop-blur-2xl md:px-5">
      <div
        className={cx(
          "mx-auto flex min-h-14 max-w-[1500px] items-center gap-1 border px-1.5 py-2 md:gap-3 md:px-3",
          mistClasses.panel,
        )}
      >
        <Link
          href="/dashboard"
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/60 bg-white/44 px-2 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_28px_rgba(15,23,42,0.06)] transition hover:bg-white/58 sm:pr-3"
          aria-label="Recruit dashboard"
        >
          <Mark size="sm" className="text-sky-600" />
          <span className="hidden font-serif text-[19px] leading-none text-sky-700 sm:inline">
            recruit
          </span>
        </Link>

        <nav className="no-scrollbar hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full border border-white/45 bg-white/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:gap-1 lg:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-slate-600 transition sm:gap-1.5 sm:px-2.5 sm:text-[12px] md:px-3 md:text-[13px]",
                  active
                    ? "border border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_24px_rgba(15,23,42,0.06)]"
                    : "border border-transparent hover:bg-white/34 hover:text-slate-900",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {showRoomToggle && (
          <div className="hidden items-center gap-0.5 rounded-full border border-white/55 bg-white/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] lg:flex">
            <Link
              href="/dashboard"
              className={cx(
                "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition",
                pathname === "/dashboard"
                  ? "border border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                  : "text-slate-500 hover:bg-white/34 hover:text-slate-800",
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              <span>2D</span>
            </Link>
            <Link
              href="/dashboard/room"
              className={cx(
                "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition",
                pathname === "/dashboard/room"
                  ? "border border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                  : "text-slate-500 hover:bg-white/34 hover:text-slate-800",
              )}
            >
              <Box className="h-3 w-3" />
              <span>3D</span>
            </Link>
            <span className="ml-1 mr-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
              beta
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <StatusBadge tone="active">live</StatusBadge>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-drawer"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/44 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/58"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        pathname={pathname}
      />
    </header>
  );
}
