"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type EasingFn = (progress: number) => number;

export type ReducedMotionOverride = boolean | "system";

export type AnimatedNumberOptions = {
  durationMs?: number;
  from?: number;
  reduceMotion?: ReducedMotionOverride;
  easing?: EasingFn;
};

export type AnimatedNumberProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> &
  AnimatedNumberOptions & {
    value: number;
    decimals?: number;
    format?: (value: number) => ReactNode;
    prefix?: ReactNode;
    suffix?: ReactNode;
  };

export type AnimatedProgressProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> &
  AnimatedNumberOptions & {
    value: number;
    min?: number;
    max?: number;
    label?: ReactNode;
    showValue?: boolean;
    formatValue?: (value: number, percent: number) => ReactNode;
    trackClassName?: string;
    fillClassName?: string;
    valueClassName?: string;
  };

const DEFAULT_DURATION_MS = 700;

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultNumberFormat(value: number, decimals: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function resolveReducedMotion(systemPreference: boolean | null, override: ReducedMotionOverride = "system") {
  return override === "system" ? Boolean(systemPreference) : override;
}

export function useDashboardReducedMotion(override: ReducedMotionOverride = "system") {
  const systemPreference = useReducedMotion();
  return resolveReducedMotion(systemPreference, override);
}

export function useAnimatedNumber(value: number, options: AnimatedNumberOptions = {}) {
  const {
    durationMs = DEFAULT_DURATION_MS,
    from,
    reduceMotion = "system",
    easing = easeOutCubic,
  } = options;
  const shouldReduceMotion = useDashboardReducedMotion(reduceMotion);
  const targetValue = Number.isFinite(value) ? value : 0;
  const initialValue = from ?? targetValue;
  const frameRef = useRef<number | null>(null);
  const displayValueRef = useRef(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const shouldSnap = shouldReduceMotion || durationMs <= 0;

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (shouldSnap) {
      return;
    }

    const startValue = from ?? displayValueRef.current;
    const startTime = window.performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = clamp(elapsed / durationMs, 0, 1);
      const easedProgress = easing(progress);
      const nextValue = startValue + (targetValue - startValue) * easedProgress;

      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    }

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [durationMs, easing, from, shouldSnap, targetValue]);

  return shouldSnap ? targetValue : displayValue;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  durationMs,
  from,
  reduceMotion,
  easing,
  format,
  prefix,
  suffix,
  className,
  ...props
}: AnimatedNumberProps) {
  const animatedValue = useAnimatedNumber(value, { durationMs, from, reduceMotion, easing });
  const renderedValue = useMemo(
    () => format?.(animatedValue) ?? defaultNumberFormat(animatedValue, decimals),
    [animatedValue, decimals, format],
  );

  return (
    <span
      className={cn("tabular-nums", className)}
      aria-label={typeof value === "number" ? defaultNumberFormat(value, decimals) : undefined}
      {...props}
    >
      {prefix}
      {renderedValue}
      {suffix}
    </span>
  );
}

export function AnimatedProgressBar({
  value,
  min = 0,
  max = 100,
  label,
  showValue = false,
  durationMs,
  from,
  reduceMotion,
  easing,
  formatValue,
  className,
  trackClassName,
  fillClassName,
  valueClassName,
  ...props
}: AnimatedProgressProps) {
  const boundedMax = max > min ? max : min + 1;
  const boundedValue = clamp(Number.isFinite(value) ? value : min, min, boundedMax);
  const animatedValue = useAnimatedNumber(boundedValue, {
    durationMs,
    from,
    reduceMotion,
    easing,
  });
  const animatedPercent = clamp(((animatedValue - min) / (boundedMax - min)) * 100, 0, 100);
  const finalPercent = clamp(((boundedValue - min) / (boundedMax - min)) * 100, 0, 100);
  const valueLabel = formatValue?.(boundedValue, finalPercent) ?? `${Math.round(finalPercent)}%`;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <div className="min-w-0 text-[11px] font-mono text-[var(--color-fg-muted)]">
              {label}
            </div>
          )}
          {showValue && (
            <div
              className={cn(
                "shrink-0 text-[11px] font-mono tabular-nums text-[var(--color-fg-subtle)]",
                valueClassName,
              )}
            >
              {valueLabel}
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "h-2 overflow-hidden rounded-full bg-[var(--color-surface-1)]",
          trackClassName,
        )}
        role="progressbar"
        aria-valuemin={min}
        aria-valuemax={boundedMax}
        aria-valuenow={boundedValue}
        aria-valuetext={typeof valueLabel === "string" ? valueLabel : undefined}
      >
        <div
          className={cn(
            "h-full rounded-full bg-[var(--color-fg)] transition-colors",
            fillClassName,
          )}
          style={{ width: `${animatedPercent}%` }}
        />
      </div>
    </div>
  );
}

export const AnimatedMeter = AnimatedProgressBar;
