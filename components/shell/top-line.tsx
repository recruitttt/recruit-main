import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/design-system";
import { Mark } from "@/components/ui/logo";

export type TopLineVariant = "mist" | "hero";

type TopLineProps = {
  brand?: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
  bottomSlot?: ReactNode;
  variant?: TopLineVariant;
  maxWidthClassName?: string;
  className?: string;
  innerClassName?: string;
};

export function TopLine({
  brand,
  nav,
  actions,
  bottomSlot,
  variant = "mist",
  maxWidthClassName = "max-w-[1500px]",
  className,
  innerClassName,
}: TopLineProps) {
  return (
    <header
      className={cx(
        "top-0 z-30 px-2 py-3 md:px-5",
        variant === "hero"
          ? "absolute inset-x-0 z-40 text-white"
          : "app-shell-header sticky text-[var(--color-fg)]",
        className,
      )}
    >
      <div
        className={cx(
          "mx-auto flex min-h-12 items-center gap-2 px-0 py-1 md:gap-3",
          maxWidthClassName,
          innerClassName,
        )}
      >
        {brand ?? <RecruitBrandLink variant={variant} />}
        {nav}
        {actions ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {bottomSlot}
    </header>
  );
}

export function RecruitBrandLink({
  href = "/",
  variant = "mist",
  className,
  ariaLabel = "Recruit home",
}: {
  href?: string;
  variant?: TopLineVariant;
  className?: string;
  ariaLabel?: string;
}) {
  const hero = variant === "hero";
  return (
    <Link
      href={href}
      className={cx(
        "flex h-10 shrink-0 items-center gap-2 rounded-full border px-2 text-slate-900 transition sm:pr-3 !no-underline",
        hero
          ? "border-white/24 bg-black/10 text-white shadow-[0_1px_2px_rgba(15,23,42,0.18)] backdrop-blur-sm hover:bg-white/15"
          : "app-nav-control",
        className,
      )}
      aria-label={ariaLabel}
    >
      <Mark
        size="sm"
        className={cx(
          hero
            ? "text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.18)]"
            : "text-[var(--color-accent)]",
        )}
      />
      <span
        className={cx(
          "font-serif text-[19px] leading-none tracking-tight [text-decoration:none!important]",
          hero ? "text-white" : "text-[var(--color-accent)]",
        )}
      >
        recruit
      </span>
    </Link>
  );
}

export function topLinePillClass(variant: TopLineVariant = "mist") {
  return cx(
    "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition !no-underline",
    variant === "hero"
      ? "border-white/24 bg-black/10 text-white shadow-[0_1px_2px_rgba(15,23,42,0.18)] backdrop-blur-sm hover:bg-white/15"
      : "app-nav-control text-[var(--color-fg)]",
  );
}

export function topLineIconButtonClass(variant: TopLineVariant = "mist") {
  return cx(
    "inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
    variant === "hero"
      ? "border-white/24 bg-black/10 text-white shadow-[0_1px_2px_rgba(15,23,42,0.18)] backdrop-blur-sm hover:bg-white/15"
      : "app-nav-control text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
  );
}
