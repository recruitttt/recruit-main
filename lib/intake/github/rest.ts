import { Octokit } from "@octokit/rest";
import type {
  Email,
  GitHubUser,
  Organization,
  Repository,
  SocialAccount,
} from "@/lib/intake/shared";

export function makeOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: "gh-applicant/0.1",
    request: { retries: 3 },
  });
}

export async function getAuthenticatedUser(octokit: Octokit): Promise<GitHubUser> {
  const r = await octokit.rest.users.getAuthenticated();
  const u = r.data;
  return {
    login: u.login,
    id: u.id,
    nodeId: u.node_id,
    avatarUrl: u.avatar_url,
    name: u.name,
    company: u.company,
    blog: u.blog,
    location: u.location,
    email: u.email,
    bio: u.bio,
    twitterUsername: u.twitter_username,
    hireable: u.hireable ?? null,
    publicRepos: u.public_repos,
    publicGists: u.public_gists,
    followers: u.followers,
    following: u.following,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    htmlUrl: u.html_url,
  };
}

export async function getEmails(octokit: Octokit): Promise<Email[]> {
  try {
    const r = await octokit.rest.users.listEmailsForAuthenticatedUser();
    return r.data.map((e) => ({
      email: e.email,
      primary: e.primary,
      verified: e.verified,
      visibility: e.visibility,
    }));
  } catch {
    return [];
  }
}

export async function getSocialAccounts(octokit: Octokit, login: string): Promise<SocialAccount[]> {
  try {
    const r = await octokit.request("GET /users/{username}/social_accounts", {
      username: login,
    });
    const list = r.data as Array<{ provider: string; url: string }>;
    return list.map((s) => ({ provider: s.provider, url: s.url }));
  } catch {
    return [];
  }
}

export async function getOrgs(octokit: Octokit): Promise<Organization[]> {
  try {
    const orgs = await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser, { per_page: 100 });
    return orgs.map((o) => ({
      login: o.login,
      id: o.id,
      description: o.description ?? null,
      url: o.url,
      avatarUrl: o.avatar_url,
    }));
  } catch {
    return [];
  }
}

export async function getRepos(octokit: Octokit): Promise<Repository[]> {
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
    sort: "pushed",
  });
  return repos.map(toRepository);
}

export async function getStarredSample(octokit: Octokit, max = 30): Promise<string[]> {
  try {
    const r = await octokit.rest.activity.listReposStarredByAuthenticatedUser({ per_page: max });
    return r.data.map((repo) => (repo as { full_name?: string }).full_name ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function getGists(octokit: Octokit) {
  try {
    const r = await octokit.rest.gists.list({ per_page: 100 });
    return r.data.map((g) => ({
      id: g.id,
      description: g.description,
      files: Object.keys(g.files ?? {}),
      htmlUrl: g.html_url,
    }));
  } catch {
    return [];
  }
}

export async function getProfileReadme(octokit: Octokit, login: string): Promise<string | null> {
  try {
    const r = await octokit.rest.repos.getReadme({ owner: login, repo: login });
    return Buffer.from(r.data.content, r.data.encoding as BufferEncoding).toString("utf-8");
  } catch {
    return null;
  }
}

function toRepository(repo: {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  fork: boolean;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count?: number;
  open_issues_count?: number;
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  default_branch?: string;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  archived?: boolean;
}): Repository {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    fork: repo.fork,
    description: repo.description,
    htmlUrl: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    watchersCount: repo.watchers_count,
    openIssuesCount: repo.open_issues_count,
    topics: repo.topics ?? [],
    license: repo.license?.spdx_id ?? repo.license?.name ?? null,
    defaultBranch: repo.default_branch,
    createdAt: repo.created_at ?? undefined,
    updatedAt: repo.updated_at ?? undefined,
    pushedAt: repo.pushed_at ?? undefined,
    archived: repo.archived,
  };
}
