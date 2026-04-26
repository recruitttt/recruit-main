export const mistColors = {
  bg: "#D5E0D0",
  text: "#102016",
  textMuted: "#435749",
  textSubtle: "#738070",
  accent: "#3F7A56",
  success: "#2F8F57",
  warning: "#B86D12",
  danger: "#EF4444",
  neutral: "#6E7B6C",
  // Scarce-use accents — ship sparingly so they keep their meaning.
  // activationGold: only at the activation orbit climax + first-job-applied moment.
  // aiPlum: only on AI-speaks surfaces (Scout dock, enrichment-chat header).
  activationGold: "#F4C26B",
  aiPlum: "#8E7EA8",
  surfacePanel: "rgba(255,255,255,0.45)",
  surfaceCard: "rgba(250,253,247,0.38)",
  surfaceControl: "rgba(255,255,255,0.52)",
  border: "rgba(255,255,255,0.55)",
} as const;

export const mistClasses = {
  page: "bg-[#D5E0D0] text-[#102016]",
  panel: "rounded-[24px] border border-white/50 bg-white/42 shadow-[0_24px_70px_rgba(15,23,42,0.13)] backdrop-blur-2xl",
  card: "rounded-[24px] border border-white/40 bg-[#FAFDF7]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.60)] backdrop-blur-xl",
  control: "rounded-full border border-white/70 bg-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur-xl",
  sectionLabel: "font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#435749]",
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
