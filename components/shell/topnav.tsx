"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cx, StatusBadge } from "@/components/design-system";
import { authClient } from "@/lib/auth-client";
import { clearLocalUserData } from "@/lib/local-data";
import {
  Box,
  ChevronDown,
  CreditCard,
  LogIn,
  LogOut,
  Menu,
  UserCircle,
} from "lucide-react";
import { fastEaseOut } from "@/lib/motion-presets";
import { MobileNav, navItems } from "./mobile-nav";
import {
  RecruitBrandLink,
  TopLine,
  topLineIconButtonClass,
  topLinePillClass,
} from "./top-line";

const MotionLink = motion.create(Link);
const ACTIVE_PILL_LAYOUT_ID = "topnav-active-pill";

export function Topnav() {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const showRoom3dBeta = pathname === "/dashboard";
  const initials = useMemo(() => {
    const name = user?.name || user?.email || "";
    const parts = name
      .replace(/@.*/, "")
      .split(/[\s._-]+/)
      .filter(Boolean);
    return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
  }, [user?.name, user?.email]);
  const signOut = () => {
    // Wipe per-user localStorage + onboarding cookie BEFORE the auth call
    // so even if the network signOut fails, the next person on this device
    // doesn't inherit the previous user's resume / chat / prefs.
    clearLocalUserData();
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
        onError: () => router.push("/"),
      },
    });
  };

  useEffect(() => {
    if (!profileOpen) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  return (
    <>
      <TopLine
        brand={<RecruitBrandLink />}
        nav={
          <nav className="no-scrollbar hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full border border-white/45 bg-white/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:gap-1 lg:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <MotionLink
                key={item.href}
                href={item.href}
                className={cx(
                  "relative flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-2.5 sm:text-[12px] md:px-3 md:text-[13px]",
                  active
                    ? "text-slate-950"
                    : "text-slate-600 hover:text-slate-900",
                )}
                aria-current={active ? "page" : undefined}
                whileHover={reduceMotion || active ? undefined : { y: -1 }}
                transition={fastEaseOut}
              >
                {active && (
                  <motion.span
                    layoutId={reduceMotion ? undefined : ACTIVE_PILL_LAYOUT_ID}
                    className="absolute inset-0 rounded-full border border-white/70 bg-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_24px_rgba(15,23,42,0.06)]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1 sm:gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              </MotionLink>
            );
          })}
          </nav>
        }
        actions={
          <>
            {showRoom3dBeta && (
              <Link
                href="/3d"
                className="hidden h-8 items-center gap-1.5 rounded-full border border-white/55 bg-white/30 px-3 text-[11px] font-semibold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:bg-white/50 hover:text-slate-900 lg:flex"
                aria-label="Try the 3D view (beta)"
                title="Try the 3D view (beta)"
              >
                <Box className="h-3 w-3" />
                <span>Try 3D</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
                  beta
                </span>
              </Link>
            )}

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {isPending ? (
                <div
                  className="h-10 w-[146px] animate-pulse rounded-full border border-white/60 bg-white/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                  aria-hidden="true"
                />
              ) : user ? (
                <>
                  <div ref={profileMenuRef} className="relative">
                    <button
                      type="button"
                      className="flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/42 py-1 pl-1 pr-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/56"
                      aria-label="Open user menu"
                      aria-haspopup="menu"
                      aria-expanded={profileOpen}
                      onClick={() => setProfileOpen((open) => !open)}
                    >
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.image}
                          alt=""
                          className="h-8 w-8 rounded-full bg-slate-950 object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold uppercase text-white">
                          {initials}
                        </span>
                      )}
                      <span className="hidden max-w-28 truncate text-[12px] font-semibold text-slate-700 xl:inline">
                        {user.name || user.email || "Account"}
                      </span>
                      <ChevronDown
                        className={cx(
                          "h-3.5 w-3.5 text-slate-500 transition",
                          profileOpen && "rotate-180",
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          role="menu"
                          className="absolute right-0 top-12 z-50 w-72 origin-top-right overflow-hidden rounded-[18px] border border-white/65 bg-white/88 p-1.5 text-slate-800 shadow-[0_22px_54px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl"
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                          transition={reduceMotion ? { duration: 0 } : fastEaseOut}
                        >
                          <div className="px-3 py-2.5">
                            <div className="truncate text-sm font-semibold text-slate-950">
                              {user.name || "Recruit user"}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {user.email}
                            </div>
                          </div>
                          <div className="my-1 h-px bg-slate-900/8" />
                          <Link
                            role="menuitem"
                            href="/settings"
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-900/6 hover:text-slate-950"
                            onClick={() => setProfileOpen(false)}
                          >
                            <UserCircle className="h-4 w-4 text-slate-500" />
                            Profile settings
                          </Link>
                          <Link
                            role="menuitem"
                            href="/pricing"
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-900/6 hover:text-slate-950"
                            onClick={() => setProfileOpen(false)}
                          >
                            <CreditCard className="h-4 w-4 text-slate-500" />
                            Billing
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    className={topLinePillClass()}
                    onClick={signOut}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </>
              ) : (
                <Link href="/sign-in" className={topLinePillClass()}>
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <StatusBadge tone="active">live</StatusBadge>
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav-drawer"
                className={topLineIconButtonClass()}
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </>
        }
      />
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        pathname={pathname}
        isPending={isPending}
        user={user}
        onSignOut={signOut}
      />
    </>
  );
}
