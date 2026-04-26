import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rect" | "circle" | "text";
}

// Uses the project-wide `shimmer` keyframe (defined in app/globals.css) via the
// `animate-shimmer` utility exposed by `@theme`'s `--animate-shimmer` token.
// The pseudo-element draws a moving sheen over a soft slate base.
export function Skeleton({ variant = "rect", className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-slate-200/60",
        variant === "rect" && "rounded-md",
        variant === "circle" && "rounded-full aspect-square",
        variant === "text" && "rounded-sm h-3.5 w-full",
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.6)_50%,transparent_100%)]",
        "before:bg-[length:200%_100%] before:bg-[position:-200%_0]",
        "motion-safe:before:animate-shimmer",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" style={{ width: `${85 - i * 8}%` }} />
      ))}
    </div>
  );
}
