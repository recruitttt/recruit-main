// Trim/format helpers for the onboarding link form. Kept separate from
// source-state.ts because they don't depend on run state — pure string ops.

interface LinksLike {
  github: string;
  linkedin: string;
  twitter: string;
  devpost: string;
  website: string;
}

export function trimLinks(links: LinksLike): LinksLike {
  return {
    github: links.github.trim(),
    linkedin: links.linkedin.trim(),
    twitter: links.twitter.trim(),
    devpost: links.devpost.trim(),
    website: links.website.trim(),
  };
}

export function compactLinks(links: LinksLike): string[] {
  return Object.entries(trimLinks(links))
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
}
