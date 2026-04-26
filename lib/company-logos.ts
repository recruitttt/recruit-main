export type CompanyLogoAsset = {
  company: string;
  domain: string;
  logoUrl: string;
  logoAlt: string;
  brandColor: string;
  backgroundColor: string;
  prestigeTag: string;
  aliases?: readonly string[];
};

export const companyLogoAssets = [
  logo("Airtable", "airtable.com", "airtable", "#18BFFF", "#E8F7FF", "Ops"),
  logo("Aleph Alpha", "aleph-alpha.com", "aleph-alpha", "#1D3557", "#E6EDF4", "Sovereign AI", undefined, "png"),
  logo("Amazon AGI", "amazon.com", "amazon-agi", "#FF9900", "#FFF4DF", "AGI", ["Amazon"], "png"),
  logo("Anthropic", "anthropic.com", "anthropic", "#CC785C", "#F5E9E2", "Safety Lab"),
  logo("Apple", "apple.com", "apple", "#111827", "#F2F4F7", "Platform"),
  logo("Ashby Systems", "ashbyhq.com", "ashby-systems", "#365A45", "#E8F2E2", "ATS", ["Ashby"], "png"),
  logo("Attio", "attio.com", "attio", "#111827", "#F2F4F7", "CRM", undefined, "png"),
  logo("Bland AI", "bland.ai", "bland-ai", "#111827", "#F2F4F7", "Voice AI", ["Bland"], "png"),
  logo("Causaly", "causaly.com", "causaly", "#273F7A", "#E8ECF7", "Bio AI", undefined, "png"),
  logo("Clay Labs", "clay.com", "clay-labs", "#5A3B1C", "#F0E7DB", "GTM AI", ["Clay"], "png"),
  logo("Clerk", "clerk.com", "clerk", "#6C47FF", "#F0ECFF", "Auth"),
  logo("Cohere", "cohere.com", "cohere", "#21473A", "#E4EFE8", "Frontier AI", undefined, "png"),
  logo("Google DeepMind", "google.com", "google-deepmind", "#4285F4", "#EAF2FF", "AI Lab", ["DeepMind", "Google"], "png"),
  logo("Linear", "linear.app", "linear", "#5E6AD2", "#EEF0FF", "Product"),
  logo("Meta", "meta.com", "meta", "#0668E1", "#E8F1FF", "AI Platform"),
  logo("Microsoft AI", "microsoft.com", "microsoft-ai", "#5E5E5E", "#EEF2F6", "Copilot", ["Microsoft"], "png"),
  logo("Mistral AI", "mistral.ai", "mistral-ai", "#FF7000", "#FFF0E3", "Frontier AI", ["Mistral"]),
  logo("NVIDIA", "nvidia.com", "nvidia", "#76B900", "#EDF8DF", "AI Compute"),
  logo("Notion", "notion.so", "notion", "#111827", "#F2F4F7", "Workspace"),
  logo("OpenAI", "openai.com", "openai", "#111827", "#ECEFED", "Frontier AI", undefined, "png"),
  logo("Palantir", "palantir.com", "palantir", "#111827", "#F2F4F7", "Data"),
  logo("Radiant", "radiantnuclear.com", "radiant", "#E15D2A", "#FFF0E8", "Energy", undefined, "png"),
  logo("Rentokil Initial", "rentokil-initial.com", "rentokil-initial", "#E30613", "#FDEBEC", "Ops", ["Rentokil"], "png"),
  logo("Tesla", "tesla.com", "tesla", "#E82127", "#FCEBEC", "Autonomy"),
  logo("Vercel", "vercel.com", "vercel", "#111827", "#F2F4F7", "Platform"),
] as const satisfies readonly CompanyLogoAsset[];

const logoAssetsByName = new Map<string, CompanyLogoAsset>();

for (const asset of companyLogoAssets) {
  logoAssetsByName.set(normalizeCompanyName(asset.company), asset);
  for (const alias of asset.aliases ?? []) {
    logoAssetsByName.set(normalizeCompanyName(alias), asset);
  }
}

export function resolveCompanyLogoAsset(company: string | null | undefined): CompanyLogoAsset | null {
  if (!company) return null;
  return logoAssetsByName.get(normalizeCompanyName(company)) ?? null;
}

export function normalizeCompanyName(company: string) {
  return company.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function logo(
  company: string,
  domain: string,
  slug: string,
  brandColor: string,
  backgroundColor: string,
  prestigeTag: string,
  aliases?: readonly string[],
  extension: "svg" | "png" = "svg",
): CompanyLogoAsset {
  return {
    company,
    domain,
    logoUrl: `/company-logos/${slug}.${extension}`,
    logoAlt: `${company} logo`,
    brandColor,
    backgroundColor,
    prestigeTag,
    aliases,
  };
}
