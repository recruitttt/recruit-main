import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-serif text-[20px] tracking-tight text-[var(--color-accent)] leading-none">
        recruit
      </span>
    </div>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-[22px] w-[22px]", className)}
      aria-hidden
    >
      {/* outer rounded square — cyan stroke */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-[var(--color-accent)] opacity-70"
      />
      {/* inner offset filled square — solid cyan, signals "agent inside the system" */}
      <rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2"
        fill="currentColor"
        className="text-[var(--color-accent)]"
      />
    </svg>
  );
}

export function CompanyLogo({
  bg,
  text,
  size = 32,
  className,
}: {
  bg: string;
  text: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-medium text-white",
        className
      )}
      style={{
        background: bg,
        width: size,
        height: size,
        fontSize: size * 0.45,
      }}
    >
      {text}
    </div>
  );
}
