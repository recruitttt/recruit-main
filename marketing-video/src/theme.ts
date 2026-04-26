export const theme = {
  bg: "#CDD5DF",
  bgLight: "#EEF3F7",
  surface: "rgba(255,255,255,0.58)",
  surfaceStrong: "rgba(255,255,255,0.78)",
  surfaceSoft: "rgba(248,251,255,0.36)",
  panelDark: "#0F172A",
  text: "#101827",
  textMuted: "#465568",
  textSubtle: "#6B7A90",
  border: "rgba(255,255,255,0.58)",
  borderStrong: "rgba(255,255,255,0.76)",
  accent: "#0EA5E9",
  accentDark: "#0284C7",
  accentSoft: "rgba(14,165,233,0.14)",
  accentGlow: "rgba(14,165,233,0.28)",
  success: "#16A34A",
  successSoft: "rgba(22,163,74,0.14)",
  warning: "#F59E0B",
  warningSoft: "rgba(245,158,11,0.14)",
  danger: "#EF4444",
  white: "#FFFFFF",
  shadow:
    "0 32px 90px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.78)",
  shadowSoft:
    "0 18px 48px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.82)",
  radiusPanel: 34,
  radiusCard: 24,
  fontDisplay: "'Instrument Serif', Georgia, serif",
  fontUi: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",

  // Legacy aliases keep the original 20s composition compilable while the new
  // clips use the current Recruit glass/mist language.
  paper: "#CDD5DF",
  paperDeep: "#EEF3F7",
  paperShadow: "#AEBBCD",
  ink: "#101827",
  inkSoft: "#465568",
  green: "#16A34A",
  greenSoft: "rgba(22,163,74,0.14)",
  blue: "#0EA5E9",
  blueSoft: "rgba(14,165,233,0.14)",
  outline: "rgba(255,255,255,0.58)",
};

export const FPS = 30;
export const DURATION_FRAMES = 600;
export const CLIP_DURATION_FRAMES = 300;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const SCENES = {
  intro: { start: 0, end: 90 },
  paste: { start: 90, end: 210 },
  tailor: { start: 210, end: 360 },
  apply: { start: 360, end: 480 },
  outro: { start: 480, end: 600 },
};
