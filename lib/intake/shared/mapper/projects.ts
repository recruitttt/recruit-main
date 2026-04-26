import type { PerRepoEnrichment, PinnedRepo, ProjectItem, Repository } from "@/lib/intake/shared";

export function deriveProjects(
  repos: Repository[],
  pinned: PinnedRepo[],
  enrichments: PerRepoEnrichment[],
  limit = 12,
): ProjectItem[] {
  const enrichmentByRepo = new Map(enrichments.map((e) => [e.repo, e]));
  const reposByName = new Map(repos.map((r) => [r.fullName, r]));
  const pickedNames = new Set<string>();
  const out: ProjectItem[] = [];

  for (const p of pinned) {
    const fullName = parseRepoFullNameFromUrl(p.url) ?? repos.find((r) => r.name === p.name)?.fullName;
    if (!fullName) continue;
    pickedNames.add(fullName);
    const repo = reposByName.get(fullName);
    if (!repo) continue;
    out.push(toProject(repo, enrichmentByRepo.get(fullName), p));
  }

  const remaining = repos
    .filter((r) => !r.fork && !r.archived && !pickedNames.has(r.fullName) && r.description)
    .sort((a, b) => {
      const score = (r: Repository) =>
        r.stargazersCount * 5 + (r.pushedAt ? Date.parse(r.pushedAt) / 1e10 : 0);
      return score(b) - score(a);
    })
    .slice(0, Math.max(0, limit - out.length));

  for (const r of remaining) out.push(toProject(r, enrichmentByRepo.get(r.fullName)));

  return out;
}

function toProject(
  repo: Repository,
  enrichment: PerRepoEnrichment | undefined,
  pinned?: PinnedRepo,
): ProjectItem {
  const rawDescription = pinned?.description ?? repo.description ?? "";
  const description = rawDescription.trim() ? rawDescription : undefined;
  const tagline = enrichment?.readme ? extractReadmeTagline(enrichment.readme) : undefined;
  const technologies = uniqueLowerThenPretty([
    ...repo.topics,
    ...(enrichment?.topics ?? []),
    ...(enrichment ? Object.keys(enrichment.languages) : []),
  ]);
  return {
    name: repo.name,
    tagline,
    description,
    repoUrl: repo.htmlUrl,
    url: repo.homepage ?? undefined,
    demoUrl: repo.homepage ?? undefined,
    startDate: repo.createdAt?.slice(0, 7),
    endDate: repo.pushedAt?.slice(0, 7),
    technologies,
    metrics: {
      stars: repo.stargazersCount,
      forks: repo.forksCount,
    },
  };
}

function extractReadmeTagline(readme: string): string | undefined {
  const lines = readme.split(/\r?\n/);
  for (const raw of lines.slice(0, 30)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("![")) continue;
    if (line.startsWith("[!")) continue;
    if (line.startsWith("<")) continue;
    if (line.length > 200) return line.slice(0, 200) + "…";
    return line;
  }
  return undefined;
}

function parseRepoFullNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

function uniqueLowerThenPretty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
