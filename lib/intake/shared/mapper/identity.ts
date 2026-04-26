import type { Identity, RawGithubSnapshot } from "@/lib/intake/shared";

export function deriveIdentity(snapshot: RawGithubSnapshot): Identity {
  const name = (snapshot.user.name ?? "").trim();
  const { first, middle, last } = splitName(name);
  return {
    legalFirstName: first,
    legalMiddleName: middle,
    legalLastName: last,
    preferredName: snapshot.user.login,
  };
}

export function splitName(name: string): { first: string; middle?: string; last: string } {
  if (!name) return { first: "", last: "" };
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  if (parts.length === 2) return { first: parts[0] ?? "", last: parts[1] ?? "" };
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const middle = parts.slice(1, -1).join(" ");
  return { first, middle: middle || undefined, last };
}

export function pickPrimaryEmail(snapshot: RawGithubSnapshot): string {
  const verifiedPrimary = snapshot.emails.find((e) => e.primary && e.verified);
  if (verifiedPrimary) return verifiedPrimary.email;
  const verified = snapshot.emails.find((e) => e.verified);
  if (verified) return verified.email;
  return snapshot.user.email ?? "";
}
