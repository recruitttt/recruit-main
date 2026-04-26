import type { ApplyServiceProfile, TailoredResume } from "./types";

export type Recruit2Profile = {
  identity: {
    firstName: string;
    preferredName: string;
    lastName: string;
    fullName: string;
    citizenship: string[];
  };
  contact: {
    email: string;
    phone: string;
    country: string;
    city: string;
    state: string;
  };
  links: Record<string, string>;
  workAuth: {
    authorizedUS: boolean;
    needsSponsorshipNow: boolean;
    needsSponsorshipFuture: boolean;
    citizenshipStatus: string;
    visaType: string;
  };
  education: Array<Record<string, string>>;
  employment: Array<Record<string, string>>;
  experience: Array<Record<string, string>>;
  skills: string[];
  preferences: {
    roles: string[];
    locations: string[];
    primaryProgrammingLanguage: string;
    programmingLanguages: Array<{ language: string; proficiency?: string; years?: string }>;
  };
  resume: {
    filename: string;
    rawText: string;
  };
  files: {
    resumePath: string;
    resumeFilename: string;
    resumeBase64: string;
    tailoredResumesByJob: Record<string, TailoredResume>;
  };
};

export function toRecruit2Profile(
  profile: ApplyServiceProfile,
  options: { resume?: TailoredResume | null; resumesByJob?: Record<string, TailoredResume> } = {},
): Recruit2Profile {
  const { firstName, lastName } = splitName(profile.name);
  const links = profile.links ?? {};
  const education = (profile.education ?? []).map((item) => ({
    school: item.school ?? item.institution ?? "",
    degree: item.degree ?? "",
    field: item.field ?? item.fieldOfStudy ?? "",
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
    gpa: item.gpa !== undefined ? String(item.gpa) : "",
  }));
  const employment = (profile.experience ?? []).map((item) => ({
    company: item.company ?? "",
    title: item.title ?? "",
    location: item.location ?? "",
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
    description: item.description ?? item.bullets?.join("\n") ?? "",
  }));
  const citizen = isUsCitizen(profile);
  const authorizedUS = profile.workAuthorization?.authorizedToWorkUS ?? citizen;
  const needsSponsorshipNow = profile.workAuthorization?.requiresSponsorshipNow ?? false;
  const needsSponsorshipFuture = profile.workAuthorization?.requiresSponsorshipFuture ?? false;
  const resume = options.resume ?? null;
  const programmingLanguages = profile.preferences?.programmingLanguages ??
    (profile.skills ?? [])
      .filter((skill) => /python|typescript|javascript|java|c\+\+|c#|go|rust|swift|kotlin/i.test(skill))
      .slice(0, 8)
      .map((language) => ({ language }));

  return {
    identity: {
      firstName,
      preferredName: firstName,
      lastName,
      fullName: profile.name ?? [firstName, lastName].filter(Boolean).join(" "),
      citizenship: citizen ? ["United States"] : profile.workAuthorization?.citizenship ?? [],
    },
    contact: {
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      country: countryFromLocation(profile.location) ?? "United States",
      city: cityFromLocation(profile.location),
      state: stateFromLocation(profile.location),
    },
    links: {
      github: links.github ?? "",
      linkedin: links.linkedin ?? "",
      portfolio: links.portfolio ?? links.website ?? links.personalWebsite ?? "",
      personalWebsite: links.personalWebsite ?? links.website ?? links.portfolio ?? "",
      googleScholar: links.googleScholar ?? "",
    },
    workAuth: {
      authorizedUS,
      needsSponsorshipNow,
      needsSponsorshipFuture,
      citizenshipStatus: citizen ? "U.S. citizen" : profile.workAuthorization?.visaType ?? "",
      visaType: profile.workAuthorization?.visaType ?? "",
    },
    education,
    employment,
    experience: employment,
    skills: profile.skills ?? [],
    preferences: {
      roles: profile.preferences?.roles ?? profile.prefs?.roles ?? [],
      locations: profile.preferences?.locations ?? profile.prefs?.locations ?? [],
      primaryProgrammingLanguage: profile.preferences?.primaryProgrammingLanguage ?? "",
      programmingLanguages,
    },
    resume: {
      filename: resume?.filename ?? profile.resume?.filename ?? "",
      rawText: profile.resume?.rawText ?? "",
    },
    files: {
      resumePath: resume?.path ?? "",
      resumeFilename: resume?.filename ?? "",
      resumeBase64: resume?.base64 ?? "",
      tailoredResumesByJob: options.resumesByJob ?? {},
    },
  };
}

function splitName(name: string | undefined): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

function isUsCitizen(profile: ApplyServiceProfile): boolean {
  const citizenship = profile.workAuthorization?.citizenship ?? [];
  if (citizenship.some((item) => /^(us|u\.s\.|usa|united states|american)$/i.test(item.trim()))) {
    return true;
  }
  const workAuth = profile.prefs?.workAuth ?? "";
  return /\b(us|u\.s\.|usa|united states)\b/i.test(workAuth) && /citizen/i.test(workAuth);
}

function countryFromLocation(location: string | undefined): string {
  if (!location) return "";
  if (/\b(us|u\.s\.|usa|united states|ca|ny|california|new york)\b/i.test(location)) {
    return "United States";
  }
  return "";
}

function cityFromLocation(location: string | undefined): string {
  if (!location) return "";
  return location.split(",")[0]?.trim() ?? "";
}

function stateFromLocation(location: string | undefined): string {
  if (!location) return "";
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1]! : "";
}
