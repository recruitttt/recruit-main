import { buildRecruit2ApplyPayload } from "./recruit2-payload";
import type { NormalizedApplyBatch } from "./types";

export type Recruit2ApiStartResult =
  | {
      ok: true;
      runId: string;
      jobs: Array<{ slug: string; name?: string; url?: string; mode?: string }>;
      baseUrl: string;
    }
  | {
      ok: false;
      reason: string;
      status: number;
    };

export function recruit2ApplyApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.APPLY_ENGINE_API_URL ?? env.RECRUIT2_APPLY_API_URL ?? "";
  const baseUrl = raw.replace(/\/+$/, "");
  if (isDisallowedApplyLabDevBaseUrl(baseUrl)) return "";
  return baseUrl;
}

export async function startRecruit2ApplyRun(
  batch: NormalizedApplyBatch,
  options: {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<Recruit2ApiStartResult> {
  const baseUrl = (options.baseUrl ?? recruit2ApplyApiBaseUrl()).replace(/\/+$/, "");
  if (!baseUrl) {
    return { ok: false, reason: "missing_apply_engine_api_url", status: 503 };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/api/apply-lab/v4/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRecruit2ApplyPayload(batch)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `apply_engine_unreachable: ${message}`,
      status: 503,
    };
  }
  const body = await response.json().catch(() => null) as
    | { runId?: string; jobs?: Array<{ slug: string; name?: string; url?: string; mode?: string }>; error?: string }
    | null;
  if (!response.ok || !body?.runId) {
    return {
      ok: false,
      reason: body?.error ?? `apply_engine_start_${response.status}`,
      status: response.status,
    };
  }
  return {
    ok: true,
    runId: body.runId,
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
    baseUrl,
  };
}

function isDisallowedApplyLabDevBaseUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /^localhost$|^127\.0\.0\.1$/.test(url.hostname) && url.port === "9000";
  } catch {
    return false;
  }
}
