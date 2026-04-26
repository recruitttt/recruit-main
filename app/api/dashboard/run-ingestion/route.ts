import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const PROVIDERS = ["ashby", "greenhouse", "lever", "workable"] as const;
type Provider = typeof PROVIDERS[number];

type ProviderResult = {
  provider: Provider;
  ok: boolean;
  ingestion?: unknown;
  ranking?: unknown;
  rankingWarning?: string | null;
  error?: string;
};

type ProviderSelection =
  | { ok: true; value: Provider[] }
  | { ok: false };

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  if ("provider" in body.value) {
    return Response.json(
      { ok: false, reason: "invalid_provider", providers: PROVIDERS },
      { status: 400 }
    );
  }

  const providers = parseProviderSelection(body.value.providers);
  if (!providers.ok) {
    return Response.json(
      { ok: false, reason: "invalid_provider", providers: PROVIDERS },
      { status: 400 }
    );
  }

  const limitSources = parseOptionalPositiveInteger(body.value.limitSources);
  if (!limitSources.ok) {
    return Response.json(
      { ok: false, reason: "invalid_limit_sources" },
      { status: 400 }
    );
  }

  const rank = body.value.rank === true;
  const client = await getConvexClient();
  if (!client) {
    return Response.json(
      { ok: false, reason: "missing_convex_url" },
      { status: 503 }
    );
  }

  try {
    if (providers.value.includes("ashby")) {
      await client.action(api.ashbyActions.seedAshbySourcesFromCareerOps, {});
    }
    if (providers.value.some((provider) => provider !== "ashby")) {
      await client.action(api.ashbyActions.seedCuratedAtsSources, {});
    }
  } catch (err) {
    return Response.json(
      { ok: false, reason: "source_seed_failed", error: errorMessage(err) },
      { status: 502 }
    );
  }

  const results = await Promise.all(
    providers.value.map((provider) => runProvider(client, provider, limitSources.value, rank, body.value.profile))
  );

  const failed = results.filter((result) => !result.ok);
  return Response.json(
    {
      ok: failed.length === 0,
      providers: results,
    },
    { status: failed.length === 0 ? 200 : 207 }
  );
}

async function runProvider(
  client: Awaited<ReturnType<typeof getConvexClient>>,
  provider: Provider,
  limitSources: number | undefined,
  rank: boolean,
  profile: unknown
): Promise<ProviderResult> {
  if (!client) return { provider, ok: false, error: "missing_convex_url" };

  try {
    const args = limitSources === undefined ? {} : { limitSources };
    const ingestion = await runProviderIngestionAction(client, provider, args);
    let ranking: unknown = null;
    let rankingWarning: string | null = null;

    if (rank) {
      try {
        ranking = await client.action(api.ashbyActions.rankIngestionRun, {
          runId: (ingestion as { runId: Id<"ingestionRuns"> }).runId,
          ...(profile ? { profile } : {}),
        });
      } catch (err) {
        rankingWarning = errorMessage(err);
      }
    }

    return { provider, ok: true, ingestion, ranking, rankingWarning };
  } catch (err) {
    return { provider, ok: false, error: errorMessage(err) };
  }
}

function runProviderIngestionAction(
  client: NonNullable<Awaited<ReturnType<typeof getConvexClient>>>,
  provider: Provider,
  args: { limitSources?: number }
) {
  if (provider === "ashby") {
    return client.action(api.ashbyActions.runAshbyIngestion, args);
  }
  return client.action(api.ashbyActions.runAtsIngestion, { provider, ...args });
}

async function readBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return { ok: true as const, value: {} };
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false as const };
    }
    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { ok: false as const };
  }
}

export function parseProviderSelection(value: unknown): ProviderSelection {
  if (value === undefined) return { ok: true, value: ["ashby"] };
  if (!Array.isArray(value)) return { ok: false as const };
  const providers = new Set<Provider>();
  for (const item of value) {
    if (!isProvider(item)) return { ok: false as const };
    providers.add(item);
  }
  if (providers.size === 0) return { ok: false as const };
  return { ok: true as const, value: Array.from(providers) };
}

function parseOptionalPositiveInteger(value: unknown) {
  if (value === undefined) return { ok: true as const, value: undefined };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    return { ok: false as const };
  }
  return { ok: true as const, value };
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.includes(value as Provider);
}

function errorMessage(err: unknown) {
  return err instanceof Error && err.message ? err.message : String(err);
}
