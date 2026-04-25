import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rect" | "circle" | "text";
}

export function Skeleton({ variant = "rect", className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-slate-200/60",
        variant === "rect" && "rounded-md",
        variant === "circle" && "rounded-full aspect-square",
        variant === "text" && "rounded-sm h-3.5 w-full",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        "before:animate-[shimmer_2s_linear_infinite]",
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
