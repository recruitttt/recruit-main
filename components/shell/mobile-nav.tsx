"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Box,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/dlq", label: "Review queue", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  isPending?: boolean;
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
  onSignOut?: () => void;
}

export function MobileNav({ isOpen, onClose, pathname, isPending = false, user, onSignOut }: MobileNavProps) {
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

  const showRoom3dBeta = pathname === "/dashboard";

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
            className="app-shell-drawer fixed inset-y-0 right-0 z-30 flex w-[80vw] max-w-[320px] flex-col gap-4 border-l border-[var(--glass-border)] px-4 py-5 text-[var(--color-fg)] shadow-[0_22px_60px_rgba(2,8,6,0.26)] lg:hidden"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={isOpen ? enterTransition : exitTransition}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-[18px] leading-none text-[var(--color-accent)]">
                recruit
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle compact />
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation"
                  className="app-nav-control flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
                        ? "app-nav-active text-[var(--color-fg)]"
                        : "border-transparent text-[var(--color-fg-muted)] hover:border-[var(--app-nav-control-border)] hover:bg-[var(--app-nav-control-hover)] hover:text-[var(--color-fg)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {showRoom3dBeta && (
              <Link
                href="/3d"
                onClick={onClose}
                className="app-nav-control mt-1 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
                aria-label="Try the 3D view (beta)"
              >
                <Box className="h-3.5 w-3.5" />
                <span>Try 3D</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                  beta
                </span>
              </Link>
            )}

            <div className="app-nav-track mt-auto rounded-2xl p-2">
              {isPending ? (
                <div className="h-10 animate-pulse rounded-xl bg-[var(--theme-compat-bg)]" aria-hidden="true" />
              ) : user ? (
                <div className="space-y-2">
                  <div className="px-2 py-1">
                    <div className="truncate text-[12px] font-semibold text-[var(--color-fg)]">
                      {user.name || "Recruit user"}
                    </div>
                    <div className="truncate text-[11px] text-[var(--color-fg-muted)]">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSignOut?.();
                    }}
                    className="app-nav-control flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--color-fg)] transition"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              ) : (
                <Link
                  href="/sign-in"
                  onClick={onClose}
                  className="app-nav-control flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--color-fg)] transition"
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
