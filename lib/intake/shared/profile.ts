import { z } from "zod";

export const ProvenanceSourceSchema = z.enum(["github", "linkedin", "manual", "inferred", "resume-pdf"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const ProvenanceSchema = z.object({
  source: ProvenanceSourceSchema,
  confidence: ConfidenceSchema,
  evidence: z
    .object({
      repo: z.string().optional(),
      sha: z.string().optional(),
      path: z.string().optional(),
      line: z.number().optional(),
      url: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

export const IdentitySchema = z.object({
  legalFirstName: z.string().default(""),
  legalMiddleName: z.string().optional(),
  legalLastName: z.string().default(""),
  preferredName: z.string().optional(),
  formerNames: z.array(z.string()).optional(),
  pronouns: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  sex: z.enum(["M", "F", "X"]).optional(),
  raceEthnicity: z.array(z.string()).optional(),
  veteranStatus: z.string().optional(),
  disabilityStatus: z.string().optional(),
  citizenship: z.array(z.string()).optional(),
  countryOfBirth: z.string().optional(),
  nationalIdLast4: z.string().optional(),
});

export const ContactSchema = z.object({
  email: z.string().default(""),
  secondaryEmail: z.string().optional(),
  phone: z.string().optional(),
  phoneType: z.enum(["mobile", "home", "work"]).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateRegion: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
});

export const WorkAuthSchema = z.object({
  authorizedToWorkUS: z.boolean().optional(),
  requiresSponsorshipNow: z.boolean().optional(),
  requiresSponsorshipFuture: z.boolean().optional(),
  visaType: z.string().optional(),
  optEadExpiration: z.string().optional(),
  workAuthByCountry: z.record(z.string(), z.boolean()).optional(),
});

export const LinksSchema = z.object({
  github: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  personalWebsite: z.string().optional(),
  twitter: z.string().optional(),
  blog: z.string().optional(),
  stackoverflow: z.string().optional(),
  behance: z.string().optional(),
  dribbble: z.string().optional(),
  medium: z.string().optional(),
  googleScholar: z.string().optional(),
  orcid: z.string().optional(),
  devto: z.string().optional(),
  huggingface: z.string().optional(),
  kaggle: z.string().optional(),
  mastodon: z.string().optional(),
  youtube: z.string().optional(),
  twitch: z.string().optional(),
  reddit: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  other: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
});

export const EducationItemSchema = z.object({
  institution: z.string(),
  institutionCeebCode: z.string().optional(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  minor: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  expectedGraduation: z.string().optional(),
  gpa: z.number().optional(),
  gpaScale: z.number().optional(),
  classRank: z.string().optional(),
  coursework: z.array(z.string()).optional(),
  honors: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  thesis: z
    .object({ title: z.string(), advisor: z.string(), abstract: z.string().optional() })
    .optional(),
  transcriptUrl: z.string().optional(),
});

export const TestScoreSchema = z.object({
  test: z.enum([
    "SAT",
    "ACT",
    "GRE",
    "GMAT",
    "TOEFL",
    "IELTS",
    "AP",
    "IB",
    "MCAT",
    "LSAT",
  ]),
  score: z.union([z.number(), z.string()]),
  section: z.string().optional(),
  dateTaken: z.string().optional(),
  superscored: z.boolean().optional(),
});

export const ExperienceItemSchema = z.object({
  company: z.string(),
  companyUrl: z.string().optional(),
  title: z.string(),
  employmentType: z
    .enum(["full-time", "part-time", "contract", "internship", "co-op", "volunteer"])
    .optional(),
  location: z.string().optional(),
  locationType: z.enum(["onsite", "remote", "hybrid"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  technologiesUsed: z.array(z.string()).optional(),
  teamSize: z.number().optional(),
  reasonForLeaving: z.string().optional(),
  salary: z
    .object({
      amount: z.number(),
      currency: z.string(),
      period: z.enum(["hour", "year"]),
    })
    .optional(),
  supervisorName: z.string().optional(),
  supervisorContact: z.string().optional(),
  canContact: z.boolean().optional(),
});

export const ProjectItemSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  description: z.string().optional(),
  role: z.string().optional(),
  url: z.string().optional(),
  repoUrl: z.string().optional(),
  demoUrl: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  metrics: z
    .object({
      stars: z.number().optional(),
      forks: z.number().optional(),
      users: z.number().optional(),
      downloads: z.number().optional(),
    })
    .optional(),
  collaborators: z.array(z.string()).optional(),
  impact: z.string().optional(),
  media: z.array(z.string()).optional(),
});

export const ProficiencySchema = z.enum(["expert", "advanced", "intermediate", "basic"]);

export const WeightedSkillSchema = z.object({
  name: z.string(),
  proficiency: ProficiencySchema.optional(),
  yearsExperience: z.number().optional(),
  bytes: z.number().optional(),
  recencyDays: z.number().optional(),
});

export const NamedSkillSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
});

export const SkillsSchema = z.object({
  languages: z.array(WeightedSkillSchema).default([]),
  frameworks: z.array(NamedSkillSchema).default([]),
  tools: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  cloudPlatforms: z.array(z.string()).default([]),
  operatingSystems: z.array(z.string()).optional(),
  methodologies: z.array(z.string()).optional(),
  softSkills: z.array(z.string()).optional(),
});

export const SpokenLanguageSchema = z.object({
  language: z.string(),
  proficiency: z.enum(["native", "fluent", "professional", "limited", "elementary"]),
  certifications: z.array(z.string()).optional(),
});

export const ActivityItemSchema = z.object({
  name: z.string(),
  organization: z.string().optional(),
  role: z.string().optional(),
  type: z.enum(["academic", "athletic", "arts", "community", "work", "research", "other"]),
  grades: z.array(z.number()).optional(),
  hoursPerWeek: z.number().optional(),
  weeksPerYear: z.number().optional(),
  description: z.string().optional(),
  leadership: z.boolean().optional(),
  continueInCollege: z.boolean().optional(),
});

export const HonorItemSchema = z.object({
  title: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  level: z.enum(["school", "local", "regional", "national", "international"]).optional(),
  description: z.string().optional(),
  monetaryValue: z.number().optional(),
});

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  credentialId: z.string().optional(),
  url: z.string().optional(),
});

export const PublicationSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  venue: z.string().optional(),
  date: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  citation: z.string().optional(),
});

export const OpenSourceItemSchema = z.object({
  project: z.string(),
  org: z.string().optional(),
  role: z.enum(["author", "maintainer", "contributor"]),
  contributionType: z.array(z.string()).optional(),
  url: z.string().optional(),
  metrics: z.object({ merged: z.number(), lines: z.number().optional() }).optional(),
});

export const EssayItemSchema = z.object({
  promptKey: z.string(),
  promptText: z.string().optional(),
  response: z.string(),
  wordCount: z.number(),
  contextTags: z.array(z.string()).optional(),
});

export const ReferenceItemSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  organization: z.string().optional(),
  relationship: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  yearsKnown: z.number().optional(),
  canContact: z.boolean(),
});

export const PreferencesSchema = z.object({
  desiredRoles: z.array(z.string()).optional(),
  desiredLocations: z.array(z.string()).optional(),
  willingToRelocate: z.boolean().optional(),
  salaryExpectation: z
    .object({ min: z.number(), max: z.number(), currency: z.string() })
    .optional(),
  earliestStartDate: z.string().optional(),
  noticePeriod: z.string().optional(),
  referralSource: z.string().optional(),
  previouslyApplied: z.boolean().optional(),
  currentEmployee: z.boolean().optional(),
  previousEmployee: z.boolean().optional(),
  openToOpportunities: z.boolean().optional(),
});

export const FinancialSchema = z.object({
  householdIncome: z.number().optional(),
  dependents: z.number().optional(),
  fafsaEfc: z.number().optional(),
  firstGenerationStudent: z.boolean().optional(),
  pellEligible: z.boolean().optional(),
});

export const DocumentsSchema = z.object({
  resumeUrl: z.string().optional(),
  coverLetterUrl: z.string().optional(),
  transcriptUrl: z.string().optional(),
  portfolioPdfUrl: z.string().optional(),
  writingSampleUrl: z.string().optional(),
  headshot: z.string().optional(),
  photoIdUrl: z.string().optional(),
});

export const MetadataSchema = z.object({
  profileVersion: z.string(),
  lastUpdated: z.string(),
  sources: z.array(ProvenanceSourceSchema),
  fieldProvenance: z.record(z.string(), ProvenanceSchema).default({}),
});

export const ApplicationProfileSchema = z.object({
  identity: IdentitySchema,
  contact: ContactSchema,
  workAuth: WorkAuthSchema.default({}),
  links: LinksSchema.default({}),
  education: z.array(EducationItemSchema).default([]),
  testScores: z.array(TestScoreSchema).optional(),
  experience: z.array(ExperienceItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  skills: SkillsSchema.default({
    languages: [],
    frameworks: [],
    tools: [],
    databases: [],
    cloudPlatforms: [],
  }),
  spokenLanguages: z.array(SpokenLanguageSchema).optional(),
  activities: z.array(ActivityItemSchema).optional(),
  honors: z.array(HonorItemSchema).optional(),
  certifications: z.array(CertificationSchema).optional(),
  publications: z.array(PublicationSchema).optional(),
  openSource: z.array(OpenSourceItemSchema).optional(),
  essays: z.array(EssayItemSchema).optional(),
  references: z.array(ReferenceItemSchema).optional(),
  preferences: PreferencesSchema.default({}),
  financial: FinancialSchema.optional(),
  documents: DocumentsSchema.default({}),
  metadata: MetadataSchema,
});

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type ProvenanceSource = z.infer<typeof ProvenanceSourceSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type WorkAuth = z.infer<typeof WorkAuthSchema>;
export type Links = z.infer<typeof LinksSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type Skills = z.infer<typeof SkillsSchema>;
export type WeightedSkill = z.infer<typeof WeightedSkillSchema>;
export type NamedSkill = z.infer<typeof NamedSkillSchema>;
export type SpokenLanguage = z.infer<typeof SpokenLanguageSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type HonorItem = z.infer<typeof HonorItemSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type OpenSourceItem = z.infer<typeof OpenSourceItemSchema>;
export type EssayItem = z.infer<typeof EssayItemSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Financial = z.infer<typeof FinancialSchema>;
export type Documents = z.infer<typeof DocumentsSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type ApplicationProfile = z.infer<typeof ApplicationProfileSchema>;
