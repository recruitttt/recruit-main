"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/ui/logo";
import { cx, mistClasses, StatusBadge } from "@/components/design-system";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Search,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dlq", label: "DLQ", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

export function Topnav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/35 bg-[#CDD5DF]/78 px-2 py-3 text-[#101827] backdrop-blur-2xl md:px-5">
      <div className={cx("mx-auto flex min-h-14 max-w-[1500px] items-center gap-1 border px-1.5 py-2 md:gap-3 md:px-3", mistClasses.panel)}>
        <Link
          href="/dashboard"
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/60 bg-white/44 px-2 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_28px_rgba(15,23,42,0.06)] transition hover:bg-white/58 sm:pr-3"
          aria-label="Recruit dashboard"
        >
          <Mark size="sm" className="text-sky-600" />
          <span className="hidden font-serif text-[19px] leading-none text-sky-700 sm:inline">recruit</span>
        </Link>

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full border border-white/45 bg-white/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:gap-1">
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
                    : "border border-transparent hover:bg-white/34 hover:text-slate-900"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <button className="flex h-10 w-72 items-center gap-2 rounded-full border border-white/60 bg-white/42 px-3 text-[12px] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/56 hover:text-slate-700 xl:w-80">
            <Search className="h-3.5 w-3.5" />
            <span className="truncate">Search applications, jobs...</span>
            <kbd className="ml-auto rounded-full border border-white/70 bg-white/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              ⌘K
            </kbd>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/38 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/56 hover:text-slate-900"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button className="flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/42 py-1 pl-1 pr-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/56">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white">
              MH
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>

        <div className="hidden shrink-0 md:block lg:hidden">
          <StatusBadge tone="active">live</StatusBadge>
        </div>
      </div>
    </header>
  );
}
