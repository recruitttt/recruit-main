import type { PerRepoEnrichment, Repository, WeightedSkill } from "@/lib/intake/shared";

const NOISE_LANGUAGES = new Set(["HTML", "CSS", "SCSS", "Less", "Markdown", "Makefile", "Shell"]);

export interface LanguageAggregate {
  name: string;
  bytes: number;
  recencyDays: number;
  proficiency: WeightedSkill["proficiency"];
}

export function aggregateLanguages(
  repos: Repository[],
  enrichments: PerRepoEnrichment[],
): LanguageAggregate[] {
  const enrichmentByRepo = new Map(enrichments.map((e) => [e.repo, e]));
  const totals = new Map<string, { bytes: number; mostRecent: number }>();
  const now = Date.now();

  for (const repo of repos) {
    if (repo.fork) continue;
    const enrichment = enrichmentByRepo.get(repo.fullName);
    const langs = enrichment?.languages ?? (repo.language ? { [repo.language]: 1000 } : {});
    const pushedMs = repo.pushedAt ? Date.parse(repo.pushedAt) : 0;
    const ageDays = pushedMs ? Math.max(1, (now - pushedMs) / 86_400_000) : 365;
    const recencyMultiplier = ageDays < 365 ? 3 : ageDays < 730 ? 2 : 1;

    for (const [name, bytes] of Object.entries(langs)) {
      if (NOISE_LANGUAGES.has(name)) continue;
      const entry = totals.get(name) ?? { bytes: 0, mostRecent: 0 };
      entry.bytes += bytes * recencyMultiplier;
      entry.mostRecent = Math.max(entry.mostRecent, pushedMs);
      totals.set(name, entry);
    }
  }

  const totalAllBytes = Array.from(totals.values()).reduce((s, e) => s + e.bytes, 0);
  if (totalAllBytes === 0) return [];

  return Array.from(totals.entries())
    .map(([name, { bytes, mostRecent }]) => {
      const share = bytes / totalAllBytes;
      const recencyDays = mostRecent ? Math.floor((now - mostRecent) / 86_400_000) : 9999;
      return {
        name,
        bytes,
        recencyDays,
        proficiency: shareToProficiency(share, recencyDays),
      };
    })
    .filter((s) => s.bytes > 1000)
    .sort((a, b) => b.bytes - a.bytes);
}

function shareToProficiency(share: number, recencyDays: number): WeightedSkill["proficiency"] {
  if (share > 0.25 && recencyDays < 365) return "expert";
  if (share > 0.15) return "advanced";
  if (share > 0.05) return "intermediate";
  return "basic";
}

export interface ToolingInference {
  tools: string[];
  cloudPlatforms: string[];
}

const WORKFLOW_TOOL_MAP: Array<{ pattern: RegExp; tool?: string; cloud?: string }> = [
  { pattern: /vercel/i, tool: "Vercel", cloud: "Vercel" },
  { pattern: /netlify/i, tool: "Netlify", cloud: "Netlify" },
  { pattern: /aws|s3|lambda|ecr|ecs/i, cloud: "AWS" },
  { pattern: /gcp|google-cloud|firebase/i, cloud: "Google Cloud" },
  { pattern: /azure/i, cloud: "Azure" },
  { pattern: /cloudflare|wrangler/i, cloud: "Cloudflare" },
  { pattern: /fly\.io|flyio/i, cloud: "Fly.io" },
  { pattern: /heroku/i, cloud: "Heroku" },
  { pattern: /docker/i, tool: "Docker" },
  { pattern: /kubernetes|k8s|kubectl|helm/i, tool: "Kubernetes" },
  { pattern: /terraform/i, tool: "Terraform" },
  { pattern: /pulumi/i, tool: "Pulumi" },
];

export function inferTooling(enrichments: PerRepoEnrichment[]): ToolingInference {
  const tools = new Set<string>();
  const clouds = new Set<string>();
  let hasGitHubActions = false;
  let hasDocker = false;

  for (const e of enrichments) {
    if (e.workflows.length > 0) hasGitHubActions = true;
    if (e.hasDockerfile) hasDocker = true;
    for (const wf of e.workflows) {
      for (const rule of WORKFLOW_TOOL_MAP) {
        if (rule.pattern.test(wf)) {
          if (rule.tool) tools.add(rule.tool);
          if (rule.cloud) clouds.add(rule.cloud);
        }
      }
    }
  }

  if (hasGitHubActions) tools.add("GitHub Actions");
  if (hasDocker) tools.add("Docker");
  return { tools: Array.from(tools), cloudPlatforms: Array.from(clouds) };
}
