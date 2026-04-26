"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav, navItems } from "./mobile-nav";
import {
  RecruitBrandLink,
  TopLine,
  topLineIconButtonClass,
  topLinePillClass,
} from "./top-line";

export function Topnav() {
  const pathname = usePathname();
  const router = useRouter();
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
          <nav className="no-scrollbar hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 sm:gap-1.5 lg:flex">
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
                    "flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-[var(--color-fg-muted)] transition sm:gap-1.5 sm:px-2.5 sm:text-[12px] md:px-3 md:text-[13px] !no-underline",
                    active
                      ? "app-nav-active border"
                      : "border border-transparent text-[var(--color-fg-muted)] hover:border-[var(--app-nav-control-border)] hover:bg-[var(--app-nav-control-hover)] hover:text-[var(--color-fg)]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="inline-flex [text-decoration:none!important] [text-decoration-color:transparent!important] [text-decoration-line:none!important]">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        }
        actions={
          <>
            <ThemeToggle />

            {showRoom3dBeta && (
              <Link
                href="/3d"
                className="app-nav-control hidden h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)] lg:flex !no-underline"
                aria-label="Try the 3D view (beta)"
                title="Try the 3D view (beta)"
              >
                <Box className="h-3 w-3" />
                <span className="inline-flex [text-decoration:none!important] [text-decoration-color:transparent!important] [text-decoration-line:none!important]">
                  Try 3D
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                  beta
                </span>
              </Link>
            )}

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {isPending ? (
                <div
                  className="app-nav-control h-10 w-[146px] animate-pulse rounded-full"
                  aria-hidden="true"
                />
              ) : user ? (
                <>
                  <div ref={profileMenuRef} className="relative">
                    <button
                      type="button"
                      className="app-nav-control flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition"
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
                      <span className="hidden max-w-28 truncate text-[12px] font-semibold text-[var(--color-fg)] xl:inline">
                        {user.name || user.email || "Account"}
                      </span>
                      <ChevronDown
                        className={cx(
                          "h-3.5 w-3.5 text-[var(--color-fg-subtle)] transition",
                          profileOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {profileOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-panel-bg)] p-1.5 text-[var(--color-fg)] shadow-[0_22px_54px_rgba(2,8,6,0.2),inset_0_1px_0_rgba(255,255,255,0.36)] backdrop-blur-2xl"
                      >
                        <div className="px-3 py-2.5">
                          <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {user.name || "Recruit user"}
                          </div>
                          <div className="truncate text-xs text-[var(--color-fg-muted)]">
                            {user.email}
                          </div>
                        </div>
                        <div className="my-1 h-px bg-[var(--color-border)]" />
                        <Link
                          role="menuitem"
                          href="/settings"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-[var(--color-fg-muted)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]"
                          onClick={() => setProfileOpen(false)}
                        >
                          <UserCircle className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                          Profile settings
                        </Link>
                        <Link
                          role="menuitem"
                          href="/pricing"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-[var(--color-fg-muted)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]"
                          onClick={() => setProfileOpen(false)}
                        >
                          <CreditCard className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                          Billing
                        </Link>
                      </div>
                    )}
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
              <ThemeToggle compact />
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
