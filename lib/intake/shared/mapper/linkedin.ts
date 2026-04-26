import type {
  LinkedInCertification,
  LinkedInEducation,
  LinkedInExperience,
  LinkedInHonor,
  LinkedInLanguage,
  LinkedInProject,
  LinkedInPublication,
  LinkedInSnapshot,
} from "@/lib/intake/linkedin";
import { dedupeLinkedInExperiences } from "@/lib/intake/linkedin/experience-dedupe";
import type {
  ApplicationProfile,
  Certification,
  EducationItem,
  ExperienceItem,
  HonorItem,
  ProjectItem,
  Publication,
  SpokenLanguage,
} from "@/lib/intake/shared";

export interface LinkedInMergeResult {
  experience: ExperienceItem[];
  education: EducationItem[];
  patches: Partial<ApplicationProfile>;
  provenance: Record<string, "linkedin">;
}

export function buildLinkedInMerge(snapshot: LinkedInSnapshot): LinkedInMergeResult {
  const experience = dedupeLinkedInExperiences(snapshot.experiences).map(toExperience);
  const education = snapshot.educations.map(toEducation);
  const projects = snapshot.projects.map(toProject).filter((x): x is ProjectItem => Boolean(x));
  const certifications = snapshot.certifications
    .map(toCertification)
    .filter((x): x is Certification => Boolean(x));
  const publications = snapshot.publications.map(toPublication).filter((x): x is Publication => Boolean(x));
  const honors = snapshot.honors.map(toHonor).filter((x): x is HonorItem => Boolean(x));
  const spokenLanguages = snapshot.languages
    .map(toSpokenLanguage)
    .filter((x): x is SpokenLanguage => Boolean(x));
  const skillNames = unique(snapshot.skills.map((s) => s.name).filter((x): x is string => Boolean(x)));

  const patches: Partial<ApplicationProfile> = {};
  const provenance: Record<string, "linkedin"> = {};

  if (snapshot.profileUrl) {
    patches.links = { linkedin: snapshot.profileUrl };
    provenance["links.linkedin"] = "linkedin";
  }

  if (snapshot.location) {
    const { city, country } = parseLocation(snapshot.location);
    if (city || country) {
      patches.contact = {
        email: "",
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      };
      if (city) provenance["contact.city"] = "linkedin";
      if (country) provenance["contact.country"] = "linkedin";
    }
  }

  if (snapshot.about) {
    patches.essays = [
      {
        promptKey: "elevator_pitch",
        promptText: "About (from LinkedIn).",
        response: snapshot.about,
        wordCount: snapshot.about.split(/\s+/).filter(Boolean).length,
        contextTags: ["linkedin-about"],
      },
    ];
    provenance["essays[elevator_pitch]"] = "linkedin";
  }

  if (snapshot.openToWork) {
    patches.preferences = { openToOpportunities: true };
    provenance["preferences.openToOpportunities"] = "linkedin";
  }

  if (skillNames.length) {
    patches.skills = {
      languages: [],
      frameworks: [],
      tools: skillNames,
      databases: [],
      cloudPlatforms: [],
    };
    for (const skill of skillNames) provenance[`skills.linkedin[${skill}]`] = "linkedin";
  }

  if (projects.length) {
    patches.projects = projects;
    for (const p of projects) provenance[`projects[${p.name}]`] = "linkedin";
  }
  if (certifications.length) {
    patches.certifications = certifications;
    for (const c of certifications) provenance[`certifications[${c.name}]`] = "linkedin";
  }
  if (publications.length) {
    patches.publications = publications;
    for (const p of publications) provenance[`publications[${p.title}]`] = "linkedin";
  }
  if (honors.length) {
    patches.honors = honors;
    for (const h of honors) provenance[`honors[${h.title}]`] = "linkedin";
  }
  if (spokenLanguages.length) {
    patches.spokenLanguages = spokenLanguages;
    for (const l of spokenLanguages) provenance[`spokenLanguages[${l.language}]`] = "linkedin";
  }

  for (const e of experience) {
    provenance[`experience[${e.company}::${e.title}]`] = "linkedin";
  }
  for (const e of education) {
    provenance[`education[${e.institution}]`] = "linkedin";
  }

  return { experience, education, patches, provenance };
}

function toExperience(x: LinkedInExperience): ExperienceItem {
  const startDate = parseLinkedInDate(x.from_date ?? undefined);
  const endDate = parseLinkedInDate(x.to_date ?? undefined);
  const isCurrent = !endDate && (x.to_date ?? "").toLowerCase().includes("present");
  return {
    company: x.company ?? "(unknown)",
    title: x.position_title ?? "(unknown)",
    location: x.location ?? undefined,
    startDate,
    endDate: isCurrent ? undefined : endDate,
    current: isCurrent,
    description: x.description ?? undefined,
  };
}

function toEducation(x: LinkedInEducation): EducationItem {
  return {
    institution: x.institution ?? "(unknown)",
    degree: x.degree ?? undefined,
    startDate: parseLinkedInDate(x.from_date ?? undefined),
    endDate: parseLinkedInDate(x.to_date ?? undefined),
    activities: x.description ? [x.description] : undefined,
  };
}

function toProject(x: LinkedInProject): ProjectItem | null {
  if (!x.name) return null;
  return {
    name: x.name,
    description: x.description ?? undefined,
    url: x.url ?? undefined,
    startDate: parseLinkedInDate(x.from_date ?? undefined),
    endDate: parseLinkedInDate(x.to_date ?? undefined),
  };
}

function toCertification(x: LinkedInCertification): Certification | null {
  if (!x.name) return null;
  return {
    name: x.name,
    issuer: x.issuer ?? "(unknown)",
    issueDate: parseLinkedInDate(x.issueDate ?? undefined),
    expirationDate: parseLinkedInDate(x.expirationDate ?? undefined),
    credentialId: x.credentialId ?? undefined,
    url: x.url ?? undefined,
  };
}

function toPublication(x: LinkedInPublication): Publication | null {
  if (!x.title) return null;
  return {
    title: x.title,
    authors: (x.authors ?? []).filter((a): a is string => Boolean(a)),
    venue: x.venue ?? undefined,
    date: parseLinkedInDate(x.date ?? undefined),
    url: x.url ?? undefined,
    citation: x.description ?? undefined,
  };
}

function toHonor(x: LinkedInHonor): HonorItem | null {
  if (!x.title) return null;
  return {
    title: x.title,
    issuer: x.issuer ?? undefined,
    date: parseLinkedInDate(x.date ?? undefined),
    description: x.description ?? undefined,
  };
}

function toSpokenLanguage(x: LinkedInLanguage): SpokenLanguage | null {
  if (!x.name) return null;
  return {
    language: x.name,
    proficiency: normalizeProficiency(x.proficiency),
  };
}

function parseLinkedInDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed || trimmed.toLowerCase() === "present") return undefined;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const match = trimmed.match(/([A-Za-z]+)?\s*(\d{4})/);
  if (!match) return undefined;
  const month = match[1] ? months[match[1].slice(0, 3).toLowerCase()] : undefined;
  const year = match[2];
  return month ? `${year}-${month}` : year;
}

function parseLocation(loc: string): { city?: string; country?: string } {
  const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { city: parts[0] };
  return { city: parts[0], country: parts[parts.length - 1] };
}

function normalizeProficiency(input: string | null | undefined): SpokenLanguage["proficiency"] {
  const lower = (input ?? "").toLowerCase();
  if (lower.includes("native")) return "native";
  if (lower.includes("fluent") || lower.includes("full professional")) return "fluent";
  if (lower.includes("limited")) return "limited";
  if (lower.includes("elementary") || lower.includes("basic")) return "elementary";
  return "professional";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}
