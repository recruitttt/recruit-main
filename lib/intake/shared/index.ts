// `./profile` (gh-app ApplicationProfileSchema) and `./types` (intake adapter
// contract) both export a `ProvenanceSource` symbol with different shapes.
// The adapter contract is canonical for the intake pipeline, so we re-export
// `./profile` without that name and let `./types` win.

export * from "./github";
export {
  ProvenanceSchema,
  ConfidenceSchema,
  IdentitySchema,
  ContactSchema,
  WorkAuthSchema,
  LinksSchema,
  EducationItemSchema,
  TestScoreSchema,
  ExperienceItemSchema,
  ProjectItemSchema,
  ProficiencySchema,
  WeightedSkillSchema,
  NamedSkillSchema,
  SkillsSchema,
  SpokenLanguageSchema,
  ActivityItemSchema,
  HonorItemSchema,
  CertificationSchema,
  PublicationSchema,
  OpenSourceItemSchema,
  EssayItemSchema,
  ReferenceItemSchema,
  PreferencesSchema,
  FinancialSchema,
  DocumentsSchema,
  MetadataSchema,
  ApplicationProfileSchema,
  ProvenanceSourceSchema,
} from "./profile";
export type {
  Provenance,
  Confidence,
  Identity,
  Contact,
  WorkAuth,
  Links,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  Skills,
  WeightedSkill,
  NamedSkill,
  SpokenLanguage,
  ActivityItem,
  HonorItem,
  Certification,
  Publication,
  OpenSourceItem,
  EssayItem,
  ReferenceItem,
  Preferences,
  Financial,
  Documents,
  Metadata,
  ApplicationProfile,
} from "./profile";
export * from "./json-resume";
export * from "./mapper/index";
export * from "./types";
export * from "./runIntake";
// Note: `./runIntakeNode` is intentionally NOT re-exported here. It pulls
// `ConvexHttpClient` from `convex/browser`, which is meant for the Next route
// runtime. Convex actions should keep importing `runIntake` directly from
// `./runIntake`. Route handlers import `runIntakeNode` from
// `@/lib/intake/shared/runIntakeNode`.
