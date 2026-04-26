"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Box,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dlq", label: "DLQ", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}

export function MobileNav({ isOpen, onClose, pathname }: MobileNavProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  // Close on Esc + initial focus on close button when opened
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);

    // Defer focus until after the drawer mounts
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const showRoomToggle = pathname === "/dashboard" || pathname === "/dashboard/room";

  const enterTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: "easeOut" as const };
  const exitTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" as const };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="mobile-nav-backdrop"
            className="fixed inset-0 z-20 bg-[rgba(15,23,42,0.4)] backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={enterTransition}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="mobile-nav-drawer"
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-y-0 right-0 z-30 flex w-[80vw] max-w-[320px] flex-col gap-4 border-l border-white/45 bg-[#CDD5DF]/95 px-4 py-5 text-[#101827] shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl lg:hidden"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={isOpen ? enterTransition : exitTransition}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-[18px] leading-none text-sky-700">
                recruit
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/55 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/72"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Primary">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold transition",
                      active
                        ? "border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                        : "border-transparent text-slate-600 hover:border-white/55 hover:bg-white/40 hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {showRoomToggle && (
              <div className="mt-1 rounded-2xl border border-white/55 bg-white/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="mb-1 flex items-center justify-between px-2 pt-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Workspace
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
                    beta
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 p-1">
                  <Link
                    href="/dashboard"
                    onClick={onClose}
                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-semibold transition",
                      pathname === "/dashboard"
                        ? "border border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                        : "border border-transparent text-slate-500 hover:bg-white/40 hover:text-slate-800",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    2D
                  </Link>
                  <Link
                    href="/dashboard/room"
                    onClick={onClose}
                    aria-current={pathname === "/dashboard/room" ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-semibold transition",
                      pathname === "/dashboard/room"
                        ? "border border-white/70 bg-white/68 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                        : "border border-transparent text-slate-500 hover:bg-white/40 hover:text-slate-800",
                    )}
                  >
                    <Box className="h-3.5 w-3.5" />
                    3D
                  </Link>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
