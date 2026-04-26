import { z } from "zod";

export const SocialAccountSchema = z.object({
  provider: z.string(),
  url: z.string(),
});

export const EmailSchema = z.object({
  email: z.string(),
  primary: z.boolean(),
  verified: z.boolean(),
  visibility: z.string().nullable().optional(),
});

export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  nodeId: z.string().optional(),
  avatarUrl: z.string().optional(),
  name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  blog: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  twitterUsername: z.string().nullable().optional(),
  hireable: z.boolean().nullable().optional(),
  publicRepos: z.number().optional(),
  publicGists: z.number().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  htmlUrl: z.string().optional(),
});

export const OrganizationSchema = z.object({
  login: z.string(),
  id: z.number(),
  description: z.string().nullable().optional(),
  url: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const ManifestParsedSchema = z.object({
  path: z.string(),
  ecosystem: z.enum([
    "npm",
    "pip",
    "go",
    "cargo",
    "rubygems",
    "pub",
    "composer",
    "maven",
    "gradle",
    "unknown",
  ]),
  dependencies: z.array(z.string()),
  devDependencies: z.array(z.string()).optional(),
});

export const ReleaseSchema = z.object({
  tagName: z.string(),
  name: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  url: z.string().optional(),
});

export const RepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  private: z.boolean(),
  fork: z.boolean(),
  description: z.string().nullable().optional(),
  htmlUrl: z.string(),
  homepage: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  stargazersCount: z.number(),
  forksCount: z.number(),
  watchersCount: z.number().optional(),
  openIssuesCount: z.number().optional(),
  topics: z.array(z.string()).default([]),
  license: z.string().nullable().optional(),
  defaultBranch: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  pushedAt: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export const PinnedRepoSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().nullable().optional(),
  stargazerCount: z.number().optional(),
  primaryLanguage: z.string().nullable().optional(),
});

export const ContributionDaySchema = z.object({
  date: z.string(),
  contributionCount: z.number(),
});

export const ContributionsCollectionSchema = z.object({
  totalContributions: z.number(),
  totalCommitContributions: z.number(),
  totalPullRequestContributions: z.number(),
  totalIssueContributions: z.number(),
  totalPullRequestReviewContributions: z.number(),
  totalRepositoriesWithContributedCommits: z.number().optional(),
  weeks: z
    .array(z.object({ contributionDays: z.array(ContributionDaySchema) }))
    .optional(),
});

export const ExternalPRSchema = z.object({
  title: z.string(),
  url: z.string(),
  repoFullName: z.string(),
  org: z.string().optional(),
  mergedAt: z.string().nullable().optional(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  additions: z.number().optional(),
  deletions: z.number().optional(),
});

export const SponsorSchema = z.object({
  login: z.string(),
  name: z.string().nullable().optional(),
  isMaintainer: z.boolean(),
});

const HttpsUrlSchema = z
  .string()
  .url()
  .refine((s) => s.startsWith("https://"), "must start with https://");

export const AchievementSchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: HttpsUrlSchema.optional(),
});

export const FetchedSourceFileSchema = z.object({
  path: z.string(),
  language: z.string().nullable().optional(),
  bytes: z.number(),
  content: z.string(),
});

export const PerRepoEnrichmentSchema = z.object({
  repo: z.string(),
  readme: z.string().nullable(),
  languages: z.record(z.string(), z.number()),
  topics: z.array(z.string()),
  manifests: z.array(ManifestParsedSchema),
  workflows: z.array(z.string()),
  releases: z.array(ReleaseSchema),
  license: z.string().nullable(),
  hasDockerfile: z.boolean().default(false),
  sourceFiles: z.array(FetchedSourceFileSchema).default([]),
});

export const RawGithubSnapshotSchema = z.object({
  fetchedAt: z.string(),
  user: GitHubUserSchema,
  socialAccounts: z.array(SocialAccountSchema).default([]),
  emails: z.array(EmailSchema).default([]),
  orgs: z.array(OrganizationSchema).default([]),
  repos: z.array(RepositorySchema).default([]),
  pinnedItems: z.array(PinnedRepoSchema).default([]),
  starredSample: z.array(z.string()).default([]),
  gists: z.array(z.object({ id: z.string(), description: z.string().nullable(), files: z.array(z.string()), htmlUrl: z.string() })).default([]),
  contributions: ContributionsCollectionSchema.optional(),
  pullRequestsToOtherOrgs: z.array(ExternalPRSchema).default([]),
  reposContributedTo: z.array(RepositorySchema).default([]),
  sponsorships: z
    .object({ received: z.array(SponsorSchema), given: z.array(SponsorSchema) })
    .default({ received: [], given: [] }),
  achievements: z.array(AchievementSchema).default([]),
  profileReadme: z.string().nullable().default(null),
  perRepoEnrichment: z.array(PerRepoEnrichmentSchema).default([]),
});

export type SocialAccount = z.infer<typeof SocialAccountSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
export type PinnedRepo = z.infer<typeof PinnedRepoSchema>;
export type ContributionsCollection = z.infer<typeof ContributionsCollectionSchema>;
export type ExternalPR = z.infer<typeof ExternalPRSchema>;
export type Sponsor = z.infer<typeof SponsorSchema>;
export type Achievement = z.infer<typeof AchievementSchema>;
export type ManifestParsed = z.infer<typeof ManifestParsedSchema>;
export type Release = z.infer<typeof ReleaseSchema>;
export type FetchedSourceFile = z.infer<typeof FetchedSourceFileSchema>;
export type PerRepoEnrichment = z.infer<typeof PerRepoEnrichmentSchema>;
export type RawGithubSnapshot = z.infer<typeof RawGithubSnapshotSchema>;
