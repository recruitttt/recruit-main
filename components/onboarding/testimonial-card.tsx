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
        <span className="rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-800">
          YC founder
        </span>
      </div>
      <div
        className={cx(
          "border border-white/55 bg-white/28 px-4 py-4",
          mistRadii.nested,
        )}
      >
        <blockquote className="font-serif text-[22px] leading-[1.12] tracking-[-0.02em] text-slate-950">
          &ldquo;{TESTIMONIAL.quote}&rdquo;
        </blockquote>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/50 pt-3">
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">
              {TESTIMONIAL.author}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
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
      className="hidden items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/60 px-3 py-1 text-[11px] text-emerald-800 sm:inline-flex"
      title={`${TESTIMONIAL.author} — ${TESTIMONIAL.meta}`}
    >
      <span className="font-serif italic">&ldquo;Worth $200k&rdquo;</span>
      <span className="text-emerald-700/70">·</span>
      <span className="font-mono uppercase tracking-[0.14em]">
        {TESTIMONIAL.author}, {TESTIMONIAL.meta}
      </span>
    </span>
  );
}
