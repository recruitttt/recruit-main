export type AtsProvider = "ashby" | "lever" | "greenhouse" | "workday" | "unknown";
export type FillMode = "auto" | "guided" | "unsupported";

export function detectProvider(url: string): AtsProvider {
  try {
    const host = new URL(url).host.toLowerCase();
    if (host.includes("ashbyhq.com") || host.includes("jobs.ashbyhq.com")) return "ashby";
    if (host.includes("jobs.lever.co") || host.includes("lever.co")) return "lever";
    if (host.includes("greenhouse.io") || host.includes("boards.greenhouse.io")) return "greenhouse";
    if (host.includes("workday") || host.includes("myworkdayjobs")) return "workday";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function fillModeForProvider(p: AtsProvider): FillMode {
  if (p === "ashby" || p === "lever") return "auto";
  if (p === "greenhouse" || p === "workday") return "guided";
  return "unsupported";
}
