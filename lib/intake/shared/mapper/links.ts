import type { Links, RawGithubSnapshot } from "@/lib/intake/shared";

const PROVIDER_MAP: Record<string, keyof Links> = {
  twitter: "twitter",
  mastodon: "mastodon",
  linkedin: "linkedin",
  youtube: "youtube",
  facebook: "facebook",
  instagram: "instagram",
  twitch: "twitch",
  reddit: "reddit",
};

const URL_HEURISTICS: Array<{ key: keyof Links; pattern: RegExp }> = [
  { key: "linkedin", pattern: /linkedin\.com\//i },
  { key: "stackoverflow", pattern: /stackoverflow\.com\//i },
  { key: "medium", pattern: /medium\.com\//i },
  { key: "devto", pattern: /dev\.to\//i },
  { key: "googleScholar", pattern: /scholar\.google\.com\//i },
  { key: "orcid", pattern: /orcid\.org\//i },
  { key: "huggingface", pattern: /huggingface\.co\//i },
  { key: "kaggle", pattern: /kaggle\.com\//i },
  { key: "behance", pattern: /behance\.net\//i },
  { key: "dribbble", pattern: /dribbble\.com\//i },
  { key: "twitter", pattern: /(?:twitter\.com|x\.com)\//i },
  { key: "mastodon", pattern: /^https?:\/\/[^/]+\/(@[^/]+|users\/)/i },
  { key: "youtube", pattern: /youtube\.com\//i },
];

export function deriveLinks(snapshot: RawGithubSnapshot): Links {
  const links: Links = { other: [] };
  const u = snapshot.user;

  if (u.htmlUrl) links.github = u.htmlUrl;
  if (u.twitterUsername) links.twitter = `https://twitter.com/${u.twitterUsername}`;
  if (u.blog) {
    const url = u.blog.startsWith("http") ? u.blog : `https://${u.blog}`;
    if (/blog/i.test(url)) links.blog = url;
    else if (/portfolio|me\.|about/i.test(url)) links.portfolio = url;
    else links.personalWebsite = url;
  }

  for (const acct of snapshot.socialAccounts) {
    const key = PROVIDER_MAP[acct.provider.toLowerCase()];
    if (key) {
      (links as Record<string, unknown>)[key] = acct.url;
      continue;
    }
    const heuristic = URL_HEURISTICS.find((h) => h.pattern.test(acct.url));
    if (heuristic) (links as Record<string, unknown>)[heuristic.key] = acct.url;
    else (links.other ??= []).push({ label: acct.provider, url: acct.url });
  }
  if (links.other && links.other.length === 0) delete links.other;
  return links;
}
