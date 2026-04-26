import type { ExternalPR, OpenSourceItem } from "@/lib/intake/shared";

export function deriveOpenSource(prs: ExternalPR[]): OpenSourceItem[] {
  const byRepo = new Map<string, { prs: ExternalPR[]; org: string | undefined }>();
  for (const pr of prs) {
    const entry = byRepo.get(pr.repoFullName) ?? { prs: [], org: pr.org };
    entry.prs.push(pr);
    byRepo.set(pr.repoFullName, entry);
  }
  return Array.from(byRepo.entries()).map(([repo, { prs, org }]) => ({
    project: repo,
    org,
    role: "contributor" as const,
    contributionType: ["pull-request"],
    url: prs[0]?.url,
    metrics: {
      merged: prs.filter((p) => p.state === "MERGED").length,
      lines: prs.reduce((s, p) => s + (p.additions ?? 0) + (p.deletions ?? 0), 0),
    },
  }));
}
