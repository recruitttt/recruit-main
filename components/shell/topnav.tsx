"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/ui/logo";
import { cx, mistClasses, StatusBadge } from "@/components/design-system";
import { authClient } from "@/lib/auth-client";
import {
  Box,
  ChevronDown,
  CreditCard,
  LogIn,
  LogOut,
  Menu,
  UserCircle,
} from "lucide-react";
import { MobileNav, navItems } from "./mobile-nav";

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
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
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

        {showRoom3dBeta && (
          <Link
            href="/dashboard/room"
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

        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
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

                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-[18px] border border-white/65 bg-white/88 p-1.5 text-slate-800 shadow-[0_22px_54px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl"
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
                  </div>
                )}
              </div>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/54 px-3 text-[13px] font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/68"
                onClick={signOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/54 px-3 text-[13px] font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/68"
            >
              <LogIn className="h-3.5 w-3.5" />
              Log in
            </Link>
          )}
        </div>

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
        isPending={isPending}
        user={user}
        onSignOut={signOut}
      />
    </header>
  );
}
