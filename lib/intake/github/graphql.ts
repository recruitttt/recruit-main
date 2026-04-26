import { graphql } from "@octokit/graphql";
import type {
  ContributionsCollection,
  ExternalPR,
  PinnedRepo,
  Sponsor,
} from "@/lib/intake/shared";

type GraphQLClient = ReturnType<typeof graphql.defaults>;

export function makeGraphQLClient(token: string): GraphQLClient {
  return graphql.defaults({
    headers: { authorization: `token ${token}`, "user-agent": "gh-applicant/0.1" },
  });
}

interface ViewerLoginResp {
  viewer: { login: string };
}

export async function getViewerLogin(client: GraphQLClient): Promise<string> {
  const r = await client<ViewerLoginResp>(`query { viewer { login } }`);
  return r.viewer.login;
}

interface PinnedResp {
  viewer: {
    pinnedItems: {
      nodes: Array<{
        name: string;
        url: string;
        description: string | null;
        stargazerCount: number;
        primaryLanguage: { name: string } | null;
      } | null>;
    };
  };
}

export async function getPinnedItems(client: GraphQLClient): Promise<PinnedRepo[]> {
  const r = await client<PinnedResp>(`
    query {
      viewer {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              url
              description
              stargazerCount
              primaryLanguage { name }
            }
          }
        }
      }
    }
  `);
  return r.viewer.pinnedItems.nodes.flatMap((n) =>
    n
      ? [{
          name: n.name,
          url: n.url,
          description: n.description,
          stargazerCount: n.stargazerCount,
          primaryLanguage: n.primaryLanguage?.name ?? null,
        }]
      : [],
  );
}

interface ContribResp {
  viewer: {
    contributionsCollection: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalIssueContributions: number;
      totalPullRequestReviewContributions: number;
      totalRepositoriesWithContributedCommits: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: Array<{
          contributionDays: Array<{ date: string; contributionCount: number }>;
        }>;
      };
    };
  };
}

export async function getContributionsCollection(client: GraphQLClient): Promise<ContributionsCollection> {
  const r = await client<ContribResp>(`
    query {
      viewer {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          totalRepositoriesWithContributedCommits
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
  `);
  const c = r.viewer.contributionsCollection;
  return {
    totalContributions: c.contributionCalendar.totalContributions,
    totalCommitContributions: c.totalCommitContributions,
    totalPullRequestContributions: c.totalPullRequestContributions,
    totalIssueContributions: c.totalIssueContributions,
    totalPullRequestReviewContributions: c.totalPullRequestReviewContributions,
    totalRepositoriesWithContributedCommits: c.totalRepositoriesWithContributedCommits,
    weeks: c.contributionCalendar.weeks,
  };
}

interface ExternalPRResp {
  search: {
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    nodes: Array<{
      title: string;
      url: string;
      state: "OPEN" | "CLOSED" | "MERGED";
      mergedAt: string | null;
      additions: number;
      deletions: number;
      repository: { nameWithOwner: string; owner: { login: string } };
    } | null>;
  };
}

const MAX_EXTERNAL_PR_PAGES = 5;

export async function getExternalMergedPRs(client: GraphQLClient, login: string): Promise<ExternalPR[]> {
  const out: ExternalPR[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_EXTERNAL_PR_PAGES; page++) {
    const r: ExternalPRResp = await client<ExternalPRResp>(
      `query($q: String!, $after: String) {
        search(query: $q, type: ISSUE, first: 100, after: $after) {
          pageInfo { endCursor hasNextPage }
          nodes {
            ... on PullRequest {
              title
              url
              state
              mergedAt
              additions
              deletions
              repository { nameWithOwner owner { login } }
            }
          }
        }
      }`,
      { q: `is:pr is:merged author:${login} -user:${login}`, after: cursor },
    );
    for (const n of r.search.nodes) {
      if (!n) continue;
      out.push({
        title: n.title,
        url: n.url,
        state: n.state,
        mergedAt: n.mergedAt,
        additions: n.additions,
        deletions: n.deletions,
        repoFullName: n.repository.nameWithOwner,
        org: n.repository.owner.login,
      });
    }
    if (!r.search.pageInfo.hasNextPage || !r.search.pageInfo.endCursor) break;
    cursor = r.search.pageInfo.endCursor;
  }
  return out;
}

interface SponsorshipsResp {
  viewer: {
    sponsorshipsAsMaintainer: {
      nodes: Array<{ sponsorEntity: { login: string; name?: string | null } | null } | null>;
    };
    sponsorshipsAsSponsor: {
      nodes: Array<{ sponsorable: { login?: string; name?: string | null } | null } | null>;
    };
  };
}

export async function getSponsorships(client: GraphQLClient): Promise<{ received: Sponsor[]; given: Sponsor[] }> {
  try {
    const r = await client<SponsorshipsResp>(`
      query {
        viewer {
          sponsorshipsAsMaintainer(first: 50) {
            nodes { sponsorEntity { ... on User { login name } ... on Organization { login name } } }
          }
          sponsorshipsAsSponsor(first: 50) {
            nodes { sponsorable { ... on User { login name } ... on Organization { login name } } }
          }
        }
      }
    `);
    const received: Sponsor[] = r.viewer.sponsorshipsAsMaintainer.nodes.flatMap((n) =>
      n?.sponsorEntity ? [{ login: n.sponsorEntity.login, name: n.sponsorEntity.name ?? null, isMaintainer: true }] : [],
    );
    const given: Sponsor[] = r.viewer.sponsorshipsAsSponsor.nodes.flatMap((n) =>
      n?.sponsorable?.login ? [{ login: n.sponsorable.login, name: n.sponsorable.name ?? null, isMaintainer: false }] : [],
    );
    return { received, given };
  } catch {
    return { received: [], given: [] };
  }
}
