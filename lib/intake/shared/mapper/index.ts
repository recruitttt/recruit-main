import type { LinkedInSnapshot } from "@/lib/intake/linkedin";
import type {
  ApplicationProfile,
  EssayItem,
  Provenance,
  RawGithubSnapshot,
} from "@/lib/intake/shared";
import { deriveHonors } from "./honors";
import { deriveIdentity, pickPrimaryEmail } from "./identity";
import { buildLinkedInMerge } from "./linkedin";
import { deriveLinks } from "./links";
import { deriveOpenSource } from "./opensource";
import { deriveProjects } from "./projects";
import { aggregateLanguages, inferTooling } from "./skills";
import { inferDatabases, inferFrameworks } from "./frameworks";

export { buildLinkedInMerge } from "./linkedin";

export interface MapOptions {
  manualOverrides?: Partial<ApplicationProfile>;
  linkedinSnapshot?: LinkedInSnapshot;
}

export function snapshotToProfile(
  snapshot: RawGithubSnapshot,
  opts: MapOptions = {},
): ApplicationProfile {
  const identity = deriveIdentity(snapshot);
  const email = pickPrimaryEmail(snapshot);
  const links = deriveLinks(snapshot);
  const projects = deriveProjects(snapshot.repos, snapshot.pinnedItems, snapshot.perRepoEnrichment);
  const aggregatedLanguages = aggregateLanguages(snapshot.repos, snapshot.perRepoEnrichment);
  const tooling = inferTooling(snapshot.perRepoEnrichment);
  const allManifests = snapshot.perRepoEnrichment.flatMap((e) => e.manifests);
  const frameworks = inferFrameworks(allManifests);
  const databases = inferDatabases(allManifests);
  const honors = deriveHonors(snapshot);
  const openSource = deriveOpenSource(snapshot.pullRequestsToOtherOrgs);
  const essays = deriveEssays(snapshot);

  const provenance: Record<string, Provenance> = {};
  if (identity.legalFirstName) provenance["identity.legalFirstName"] = github(`user.name from /user`, "medium");
  if (email) provenance["contact.email"] = github(`primary verified email`, "high");
  if (links.github) provenance["links.github"] = github("user.htmlUrl", "high");
  for (const acct of snapshot.socialAccounts) {
    provenance[`links[${acct.provider}]`] = github(`/users/${snapshot.user.login}/social_accounts`, "high");
  }
  for (const p of projects) provenance[`projects[${p.name}]`] = github(`repo ${p.repoUrl ?? p.name}`, "high");
  for (const lang of aggregatedLanguages) {
    provenance[`skills.languages[${lang.name}]`] = github(
      `aggregated repo language bytes (${lang.bytes.toLocaleString()} weighted bytes)`,
      "high",
    );
  }
  for (const fw of frameworks) {
    provenance[`skills.frameworks[${fw.name}]`] = github(
      `${fw.evidence.ecosystem} dep "${fw.evidence.dep}"`,
      "high",
    );
  }

  let mergedExperience: ApplicationProfile["experience"] = [];
  let mergedEducation: ApplicationProfile["education"] = [];
  let mergedLinks: ApplicationProfile["links"] = links;
  let mergedProjects: ApplicationProfile["projects"] = projects;
  let mergedSkills: ApplicationProfile["skills"] = {
    languages: aggregatedLanguages.map((s) => ({
      name: s.name,
      proficiency: s.proficiency,
      bytes: s.bytes,
      recencyDays: s.recencyDays,
    })),
    frameworks: frameworks.map((f) => ({ name: f.name, category: f.category })),
    tools: tooling.tools,
    databases,
    cloudPlatforms: tooling.cloudPlatforms,
  };
  let mergedHonors: ApplicationProfile["honors"] = honors;
  let mergedCertifications: ApplicationProfile["certifications"] | undefined;
  let mergedPublications: ApplicationProfile["publications"] | undefined;
  let mergedSpokenLanguages: ApplicationProfile["spokenLanguages"] | undefined;
  let mergedEssays = essays;
  let mergedContact: ApplicationProfile["contact"] = { email };
  let mergedPreferences: ApplicationProfile["preferences"] = {
    openToOpportunities: snapshot.user.hireable ?? undefined,
  };
  const sources: Array<"github" | "linkedin" | "manual" | "inferred" | "resume-pdf"> = ["github"];

  if (opts.linkedinSnapshot) {
    const linked = buildLinkedInMerge(opts.linkedinSnapshot);
    mergedExperience = linked.experience;
    mergedEducation = linked.education;
    if (linked.patches.contact) {
      mergedContact = { ...mergedContact, ...linked.patches.contact, email: mergedContact.email };
    }
    if (linked.patches.links) {
      mergedLinks = { ...mergedLinks, ...linked.patches.links };
    }
    if (linked.patches.projects) {
      mergedProjects = mergeProjects(mergedProjects, linked.patches.projects);
    }
    if (linked.patches.skills) {
      mergedSkills = {
        ...mergedSkills,
        tools: uniqueStrings([...mergedSkills.tools, ...linked.patches.skills.tools]),
        softSkills: uniqueStrings([...(mergedSkills.softSkills ?? []), ...(linked.patches.skills.softSkills ?? [])]),
        methodologies: uniqueStrings([
          ...(mergedSkills.methodologies ?? []),
          ...(linked.patches.skills.methodologies ?? []),
        ]),
      };
    }
    if (linked.patches.honors) {
      mergedHonors = mergeByKey(mergedHonors ?? [], linked.patches.honors, (h) => h.title);
    }
    if (linked.patches.certifications) {
      mergedCertifications = mergeByKey(mergedCertifications ?? [], linked.patches.certifications, (c) => c.name);
    }
    if (linked.patches.publications) {
      mergedPublications = mergeByKey(mergedPublications ?? [], linked.patches.publications, (p) => p.title);
    }
    if (linked.patches.spokenLanguages) {
      mergedSpokenLanguages = mergeByKey(
        mergedSpokenLanguages ?? [],
        linked.patches.spokenLanguages,
        (l) => l.language,
      );
    }
    if (linked.patches.essays) {
      mergedEssays = linked.patches.essays.concat(mergedEssays ?? []);
    }
    if (linked.patches.preferences) {
      mergedPreferences = { ...mergedPreferences, ...linked.patches.preferences };
    }
    for (const [path, source] of Object.entries(linked.provenance)) {
      provenance[path] = { source, confidence: "medium", evidence: { note: opts.linkedinSnapshot.profileUrl } };
    }
    sources.push("linkedin");
  }

  const profile: ApplicationProfile = {
    identity,
    contact: mergedContact,
    workAuth: {},
    links: mergedLinks,
    education: mergedEducation,
    experience: mergedExperience,
    projects: mergedProjects,
    skills: mergedSkills,
    activities: undefined,
    honors: mergedHonors,
    certifications: mergedCertifications,
    publications: mergedPublications,
    spokenLanguages: mergedSpokenLanguages,
    openSource,
    essays: mergedEssays,
    preferences: mergedPreferences,
    documents: {},
    metadata: {
      profileVersion: "1",
      lastUpdated: new Date().toISOString(),
      sources,
      fieldProvenance: provenance,
    },
  };

  return mergeOverrides(profile, opts.manualOverrides);
}

function github(note: string, confidence: Provenance["confidence"]): Provenance {
  return { source: "github", confidence, evidence: { note } };
}

function deriveEssays(snapshot: RawGithubSnapshot): EssayItem[] | undefined {
  const out: EssayItem[] = [];
  if (snapshot.user.bio) {
    out.push({
      promptKey: "elevator_pitch",
      promptText: "Tell us about yourself in one sentence.",
      response: snapshot.user.bio,
      wordCount: snapshot.user.bio.split(/\s+/).filter(Boolean).length,
      contextTags: ["github-bio"],
    });
  }
  if (snapshot.profileReadme) {
    const trimmed = snapshot.profileReadme.slice(0, 4000);
    out.push({
      promptKey: "profile_readme",
      promptText: "About me (from GitHub profile README).",
      response: trimmed,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      contextTags: ["github-profile-readme"],
    });
  }
  return out.length ? out : undefined;
}

function mergeOverrides(
  base: ApplicationProfile,
  overrides: Partial<ApplicationProfile> | undefined,
): ApplicationProfile {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...(overrides.identity ?? {}) },
    contact: { ...base.contact, ...(overrides.contact ?? {}) },
    workAuth: { ...base.workAuth, ...(overrides.workAuth ?? {}) },
    links: { ...base.links, ...(overrides.links ?? {}) },
    skills: { ...base.skills, ...(overrides.skills ?? {}) },
    preferences: { ...base.preferences, ...(overrides.preferences ?? {}) },
    documents: { ...base.documents, ...(overrides.documents ?? {}) },
    metadata: {
      ...base.metadata,
      ...(overrides.metadata ?? {}),
      sources: Array.from(new Set([...base.metadata.sources, ...(overrides.metadata?.sources ?? ["manual"])])),
    },
  };
}

function mergeProjects(
  base: ApplicationProfile["projects"],
  incoming: ApplicationProfile["projects"],
): ApplicationProfile["projects"] {
  return mergeByKey(base, incoming, (p) => p.repoUrl ?? p.url ?? p.name);
}

function mergeByKey<T>(base: T[], incoming: T[], keyFn: (item: T) => string | undefined): T[] {
  const out = [...base];
  const seen = new Set(base.map(keyFn).filter((x): x is string => Boolean(x)));
  for (const item of incoming) {
    const key = keyFn(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}
