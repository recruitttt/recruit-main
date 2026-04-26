"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cx } from "@/components/design-system";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const resolvedTheme = mounted ? theme : "light";
  const dark = resolvedTheme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cx(
        "app-nav-control group relative inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full p-1 text-[var(--color-fg)] transition",
        compact ? "w-10 justify-center" : "min-w-[104px] pr-3",
        className,
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-toggle-thumb-border)] bg-[var(--app-toggle-thumb-bg)] shadow-[var(--app-toggle-thumb-shadow)]">
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: dark ? 0 : 1, rotate: dark ? -35 : 0, scale: dark ? 0.72 : 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Sun className="h-4 w-4 text-[#B86D12]" />
        </motion.span>
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: dark ? 1 : 0, rotate: dark ? 0 : 35, scale: dark ? 1 : 0.72 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Moon className="h-4 w-4 text-[#8E7EA8]" />
        </motion.span>
      </span>
      {compact ? null : (
        <span className="text-[12px] font-semibold">
          {dark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}
