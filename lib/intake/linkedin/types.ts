import { z } from "zod";

const NullableString = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") return val;
    if (Array.isArray(val)) return val.filter((x) => x != null).map(String).join(" ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  },
  z.union([z.string(), z.null()]).optional(),
);

export const LinkedInExperienceSchema = z.object({
  position_title: NullableString,
  company: NullableString,
  location: NullableString,
  from_date: NullableString,
  to_date: NullableString,
  description: NullableString,
  linkedin_url: NullableString,
});

export const LinkedInEducationSchema = z.object({
  institution: NullableString,
  degree: NullableString,
  from_date: NullableString,
  to_date: NullableString,
  description: NullableString,
  linkedin_url: NullableString,
});

export const LinkedInNamedSchema = z.object({
  name: NullableString,
  category: NullableString,
});

export const LinkedInContactSchema = z.object({
  name: NullableString,
  occupation: NullableString,
  url: NullableString,
});

export const LinkedInProjectSchema = z.object({
  name: NullableString,
  description: NullableString,
  from_date: NullableString,
  to_date: NullableString,
  url: NullableString,
});

export const LinkedInCertificationSchema = z.object({
  name: NullableString,
  issuer: NullableString,
  issueDate: NullableString,
  expirationDate: NullableString,
  credentialId: NullableString,
  url: NullableString,
});

export const LinkedInPublicationSchema = z.object({
  title: NullableString,
  authors: z.array(NullableString).default([]),
  venue: NullableString,
  date: NullableString,
  url: NullableString,
  description: NullableString,
});

export const LinkedInHonorSchema = z.object({
  title: NullableString,
  issuer: NullableString,
  date: NullableString,
  description: NullableString,
});

export const LinkedInLanguageSchema = z.object({
  name: NullableString,
  proficiency: NullableString,
});

export const LinkedInSnapshotSchema = z.object({
  fetchedAt: z.string(),
  profileUrl: z.string(),
  name: NullableString,
  about: NullableString,
  location: NullableString,
  openToWork: z.boolean().optional().default(false),
  jobTitle: NullableString,
  company: NullableString,
  experiences: z.array(LinkedInExperienceSchema).default([]),
  educations: z.array(LinkedInEducationSchema).default([]),
  skills: z.array(LinkedInNamedSchema).default([]),
  projects: z.array(LinkedInProjectSchema).default([]),
  certifications: z.array(LinkedInCertificationSchema).default([]),
  publications: z.array(LinkedInPublicationSchema).default([]),
  honors: z.array(LinkedInHonorSchema).default([]),
  languages: z.array(LinkedInLanguageSchema).default([]),
  interests: z.array(LinkedInNamedSchema).default([]),
  accomplishments: z.array(LinkedInNamedSchema).default([]),
  contacts: z.array(LinkedInContactSchema).default([]),
});

export type LinkedInExperience = z.infer<typeof LinkedInExperienceSchema>;
export type LinkedInEducation = z.infer<typeof LinkedInEducationSchema>;
export type LinkedInProject = z.infer<typeof LinkedInProjectSchema>;
export type LinkedInCertification = z.infer<typeof LinkedInCertificationSchema>;
export type LinkedInPublication = z.infer<typeof LinkedInPublicationSchema>;
export type LinkedInHonor = z.infer<typeof LinkedInHonorSchema>;
export type LinkedInLanguage = z.infer<typeof LinkedInLanguageSchema>;
export type LinkedInSnapshot = z.infer<typeof LinkedInSnapshotSchema>;

export type LinkedInProgress =
  | { stage: "starting"; message: string }
  | { stage: "login"; message: string }
  | { stage: "scrape"; message: string }
  | { stage: "complete"; message: string }
  | { stage: "error"; error: string };
