import type { FormProvider } from "./types";

export type IdempotencyInput = {
  profileId?: string | null;
  demoUserId?: string | null;
  provider: FormProvider;
  providerJobId?: string | null;
  targetUrl: string;
  company?: string | null;
  title?: string | null;
};

export function canonicalizeJobUrl(targetUrl: string): string {
  try {
    const url = new URL(targetUrl);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (url.hostname === "jobs.ashbyhq.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2) {
        url.pathname = `/${parts[0]}/${parts[1]}/application`;
      }
    }
    return url.toString();
  } catch {
    return normalizeKeyPart(targetUrl);
  }
}

export function extractProviderJobId(provider: FormProvider, targetUrl: string): string | null {
  if (provider !== "ashby") return null;
  try {
    const url = new URL(targetUrl);
    if (url.hostname.toLowerCase() !== "jobs.ashbyhq.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

export function computeApplicationIdempotencyKey(input: IdempotencyInput): string {
  const canonicalUrl = canonicalizeJobUrl(input.targetUrl);
  const providerJobId = input.providerJobId ?? extractProviderJobId(input.provider, canonicalUrl);
  const subject = input.profileId ?? input.demoUserId ?? "unknown-profile";
  const raw = [
    subject,
    input.provider,
    providerJobId ?? canonicalUrl,
    normalizeKeyPart(input.company),
    normalizeKeyPart(input.title),
  ].join("|");
  return `${input.provider}:${stableHash(raw)}`;
}

export function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
