import { Wordmark } from "@/components/ui/logo";
import {
  GlassCard,
  cx,
  mistClasses,
} from "@/components/design-system";

export function OnboardingFallback() {
  return (
    <main className={cx("min-h-screen", mistClasses.page)}>
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Wordmark size="sm" />
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
        <GlassCard density="spacious">
          <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>
            Scout intake
          </div>
          <div className="mt-3 h-8 w-72 max-w-full rounded-full bg-white/45" />
          <div className="mt-4 h-4 w-96 max-w-full rounded-full bg-white/35" />
        </GlassCard>
      </div>
    </main>
  );
}
