"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Bell, ChevronDown } from "lucide-react";
import { RoomToggle } from "@/components/room/room-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dlq", label: "DLQ" },
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Pricing" },
];

export function Topnav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <div className="flex h-14 min-w-0 items-center gap-3 px-4 md:gap-6 md:px-6">
        <Link href="/dashboard" className="shrink-0">
          <Wordmark />
        </Link>

        <div className="hidden h-5 w-px shrink-0 bg-[var(--color-border)] sm:block" />

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium tracking-tight transition-colors",
                  active
                    ? "text-[var(--color-fg)] bg-[var(--color-surface-1)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <RoomToggle />
          <button className="flex h-8 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-fg-subtle)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)] transition-colors w-80">
            <Search className="h-3.5 w-3.5" />
            <span>Search applications, jobs…</span>
            <kbd className="ml-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
              ⌘K
            </kbd>
          </button>
          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
          <button className="flex h-8 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-1 pr-2 hover:border-[var(--color-border-strong)] transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-cyan-500 to-blue-700 text-[10px] font-medium text-white">
              MH
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--color-fg-subtle)]" />
          </button>
        </div>
      </div>
    </header>
  );
}
