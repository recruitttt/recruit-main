import type { ApplicationProfile } from "./profile";

export interface JsonResume {
  $schema?: string;
  basics?: {
    name?: string;
    label?: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: {
      address?: string;
      postalCode?: string;
      city?: string;
      countryCode?: string;
      region?: string;
    };
    profiles?: Array<{ network: string; username?: string; url: string }>;
  };
  work?: Array<{
    name?: string;
    position?: string;
    location?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    institution?: string;
    url?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    score?: string;
    courses?: string[];
  }>;
  skills?: Array<{ name: string; level?: string; keywords?: string[] }>;
  projects?: Array<{
    name: string;
    description?: string;
    highlights?: string[];
    keywords?: string[];
    url?: string;
    startDate?: string;
    endDate?: string;
  }>;
  awards?: Array<{ title: string; date?: string; awarder?: string; summary?: string }>;
  certificates?: Array<{ name: string; date?: string; issuer?: string; url?: string }>;
  publications?: Array<{
    name?: string;
    publisher?: string;
    releaseDate?: string;
    url?: string;
    summary?: string;
  }>;
  languages?: Array<{ language: string; fluency?: string }>;
  interests?: Array<{ name: string; keywords?: string[] }>;
  references?: Array<{ name: string; reference?: string }>;
  meta?: { version?: string; lastModified?: string };
}

const PROFILE_NETWORKS = new Map<string, string>([
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["twitter", "Twitter"],
  ["mastodon", "Mastodon"],
  ["youtube", "YouTube"],
  ["twitch", "Twitch"],
  ["reddit", "Reddit"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["stackoverflow", "Stack Overflow"],
  ["medium", "Medium"],
  ["devto", "DEV"],
  ["googleScholar", "Google Scholar"],
  ["orcid", "ORCID"],
  ["huggingface", "Hugging Face"],
  ["kaggle", "Kaggle"],
  ["behance", "Behance"],
  ["dribbble", "Dribbble"],
]);

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "u.s.a.": "US",
  "u.s.": "US",
  america: "US",
  "united kingdom": "GB",
  uk: "GB",
  "u.k.": "GB",
  "great britain": "GB",
  england: "GB",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  deutschland: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  japan: "JP",
  china: "CN",
  india: "IN",
  brazil: "BR",
  mexico: "MX",
  netherlands: "NL",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  ireland: "IE",
  switzerland: "CH",
  austria: "AT",
  belgium: "BE",
  poland: "PL",
  portugal: "PT",
  singapore: "SG",
  "south korea": "KR",
  korea: "KR",
  "new zealand": "NZ",
  israel: "IL",
  uae: "AE",
  "united arab emirates": "AE",
};

function normalizeCountryCode(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()];
}

export function profileToJsonResume(profile: ApplicationProfile): JsonResume {
  const links = profile.links;
  const profiles: NonNullable<JsonResume["basics"]>["profiles"] = [];
  for (const [key, network] of PROFILE_NETWORKS) {
    const url = (links as Record<string, unknown>)[key];
    if (typeof url === "string" && url) {
      profiles.push({ network, url });
    }
  }
  for (const o of links.other ?? []) profiles.push({ network: o.label, url: o.url });

  const fullName = [profile.identity.legalFirstName, profile.identity.legalMiddleName, profile.identity.legalLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    $schema:
      "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: profile.identity.preferredName || fullName || undefined,
      email: profile.contact.email || undefined,
      phone: profile.contact.phone,
      url: links.portfolio || links.personalWebsite || links.blog,
      summary: profile.essays?.find((e) => e.promptKey === "elevator_pitch")?.response,
      location: {
        address: profile.contact.addressLine1,
        postalCode: profile.contact.postalCode,
        city: profile.contact.city,
        countryCode: normalizeCountryCode(profile.contact.country),
        region: profile.contact.stateRegion,
      },
      profiles,
    },
    work: profile.experience.map((e) => ({
      name: e.company,
      position: e.title,
      location: e.location,
      url: e.companyUrl,
      startDate: e.startDate,
      endDate: e.current ? undefined : e.endDate,
      summary: e.description,
      highlights: e.bullets,
    })),
    education: profile.education.map((e) => ({
      institution: e.institution,
      area: e.fieldOfStudy,
      studyType: e.degree,
      startDate: e.startDate,
      endDate: e.endDate ?? e.expectedGraduation,
      score: e.gpa !== undefined ? `${e.gpa}/${e.gpaScale ?? 4.0}` : undefined,
      courses: e.coursework,
    })),
    skills: [
      ...profile.skills.languages.map((s) => ({
        name: s.name,
        level: s.proficiency,
        keywords: [],
      })),
      ...profile.skills.frameworks.map((f) => ({
        name: f.name,
        keywords: f.category ? [f.category] : [],
      })),
      ...(profile.skills.tools.length
        ? [{ name: "Tools", keywords: profile.skills.tools }]
        : []),
      ...(profile.skills.databases.length
        ? [{ name: "Databases", keywords: profile.skills.databases }]
        : []),
      ...(profile.skills.cloudPlatforms.length
        ? [{ name: "Cloud", keywords: profile.skills.cloudPlatforms }]
        : []),
    ],
    projects: profile.projects.map((p) => ({
      name: p.name,
      description: p.description,
      highlights: p.impact ? [p.impact] : undefined,
      keywords: p.technologies,
      url: p.demoUrl ?? p.url ?? p.repoUrl,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    awards: profile.honors?.map((h) => ({
      title: h.title,
      date: h.date,
      awarder: h.issuer,
      summary: h.description,
    })),
    certificates: profile.certifications?.map((c) => ({
      name: c.name,
      date: c.issueDate,
      issuer: c.issuer,
      url: c.url,
    })),
    publications: profile.publications?.map((p) => ({
      name: p.title,
      publisher: p.venue,
      releaseDate: p.date,
      url: p.url,
      summary: p.citation,
    })),
    languages: profile.spokenLanguages?.map((l) => ({
      language: l.language,
      fluency: l.proficiency,
    })),
    references: profile.references?.map((r) => ({
      name: r.name,
      reference: `${r.relationship}${r.organization ? `, ${r.organization}` : ""}`,
    })),
    meta: { version: "1.0.0", lastModified: profile.metadata.lastUpdated },
  };
}
