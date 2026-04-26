import type * as React from "react";
import { GlassCard } from "@/components/design-system";

export function ChatCard({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassCard density="normal" className="mt-2">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/38">
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </GlassCard>
  );
}
