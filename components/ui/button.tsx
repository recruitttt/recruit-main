"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { fastEaseOut } from "@/lib/motion-presets";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none rounded-md text-sm font-medium tracking-tight transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-black shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset]",
        accent:
          "bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110 hover:shadow-[0_8px_20px_-8px_rgba(63,122,86,0.34)] glow-accent",
        secondary:
          "bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
        ghost:
          "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-1)]",
        outline:
          "border border-[var(--color-border-strong)] text-[var(--color-fg)] hover:bg-[var(--color-surface-1)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-[15px]",
        xl: "h-12 px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, disabled, ...props }, ref) => {
    const reduce = useReducedMotion();
    const isInteractive = !reduce && !disabled;
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={isInteractive ? { scale: 1.02, y: -1 } : undefined}
        whileTap={isInteractive ? { scale: 0.97 } : undefined}
        transition={fastEaseOut}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
