import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Mark />
      <span className="font-serif text-[19px] tracking-tight text-[var(--color-fg)] leading-none">
        Recruit
      </span>
    </div>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-fg)]",
        className
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="h-3.5 w-3.5 text-[var(--color-bg)]"
      >
        <path
          d="M3 13V3h6.2c2.3 0 3.8 1.4 3.8 3.4 0 1.5-.8 2.6-2.1 3.1L13.4 13h-2.5l-2.2-3.2H5V13H3zm2-4.8h4.1c1.1 0 1.9-.7 1.9-1.7 0-1.1-.8-1.7-1.9-1.7H5v3.4z"
          fill="currentColor"
        />
      </svg>
    </div>
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
