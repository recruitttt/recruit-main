import {
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { TESTIMONIAL } from "@/app/onboarding/_data";

export function TestimonialCard() {
  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={mistClasses.sectionLabel}>Testimonial</span>
        <span className="rounded-full border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-success)]">
          YC founder
        </span>
      </div>
      <div
        className={cx(
          "border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] px-4 py-4",
          mistRadii.nested,
        )}
      >
        <blockquote className="font-serif text-[22px] leading-[1.12] tracking-[-0.02em] text-[var(--color-fg)]">
          &ldquo;{TESTIMONIAL.quote}&rdquo;
        </blockquote>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-3">
          <div>
            <div className="text-sm font-semibold tracking-tight text-[var(--color-fg)]">
              {TESTIMONIAL.author}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {TESTIMONIAL.meta}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * Compact one-line testimonial badge for the new header / mobile collapse.
 */
export function TestimonialBadge() {
  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3 py-1 text-[11px] text-[var(--color-success)] sm:inline-flex"
      title={`${TESTIMONIAL.author} — ${TESTIMONIAL.meta}`}
    >
      <span className="font-serif italic">&ldquo;Worth $200k&rdquo;</span>
      <span className="text-[var(--color-success)] opacity-70">·</span>
      <span className="font-mono uppercase tracking-[0.14em]">
        {TESTIMONIAL.author}, {TESTIMONIAL.meta}
      </span>
    </span>
  );
}
