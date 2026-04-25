import { cn } from "@/lib/utils";
import { type ReactNode, type ComponentType } from "react";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-[20px] border border-white/50 bg-white/45 p-8",
        "shadow-[0_10px_30px_-20px_rgba(15,23,42,0.15)]",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50/80 text-sky-600">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="text-base font-medium leading-tight text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-snug text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
