export const mistColors = {
  bg: "#CDD5DF",
  text: "#101827",
  textMuted: "#465568",
  textSubtle: "#6B7A90",
  accent: "#0EA5E9",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",
  neutral: "#64748B",
  surfacePanel: "rgba(255,255,255,0.45)",
  surfaceCard: "rgba(248,251,255,0.35)",
  surfaceControl: "rgba(255,255,255,0.52)",
  border: "rgba(255,255,255,0.55)",
} as const;

export const mistClasses = {
  page: "bg-[#CDD5DF] text-[#101827]",
  panel: "rounded-[24px] border border-white/50 bg-white/42 shadow-[0_24px_70px_rgba(15,23,42,0.13)] backdrop-blur-2xl",
  card: "rounded-[24px] border border-white/40 bg-[#F8FBFF]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.60)] backdrop-blur-xl",
  control: "rounded-full border border-white/70 bg-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur-xl",
  sectionLabel: "font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#465568]",
} as const;

export const mistRadii = {
  panel: "rounded-[24px]",
  nested: "rounded-[20px]",
  control: "rounded-full",
} as const;

export type StatusTone = "active" | "accent" | "success" | "warning" | "danger" | "neutral" | "locked";

export function getStatusColor(tone: StatusTone = "accent") {
  if (tone === "active" || tone === "accent") return mistColors.accent;
  if (tone === "success") return mistColors.success;
  if (tone === "warning") return mistColors.warning;
  if (tone === "danger") return mistColors.danger;
  if (tone === "locked") return mistColors.textMuted;
  return mistColors.neutral;
}
