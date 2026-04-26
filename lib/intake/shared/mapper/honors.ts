import type { HonorItem, RawGithubSnapshot } from "@/lib/intake/shared";

export function deriveHonors(snapshot: RawGithubSnapshot): HonorItem[] {
  const honors: HonorItem[] = [];
  for (const a of snapshot.achievements) {
    honors.push({
      title: a.name ?? toTitle(a.slug),
      issuer: "GitHub",
      description: a.description,
    });
  }
  if (snapshot.sponsorships.received.length > 0) {
    honors.push({
      title: `GitHub Sponsors — ${snapshot.sponsorships.received.length} backer${snapshot.sponsorships.received.length === 1 ? "" : "s"}`,
      issuer: "GitHub",
    });
  }
  return honors;
}

function toTitle(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
