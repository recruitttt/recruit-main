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
  return (
    env.RECRUIT2_APPLY_API_URL ??
    env.APPLY_LAB_PUBLIC_BASE_URL ??
    env.NEXT_PUBLIC_APPLY_LAB_PUBLIC_BASE_URL ??
    ""
  ).replace(/\/+$/, "");
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
    return { ok: false, reason: "missing_recruit2_apply_api_url", status: 503 };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/apply-lab/v4/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRecruit2ApplyPayload(batch)),
  });
  const body = await response.json().catch(() => null) as
    | { runId?: string; jobs?: Array<{ slug: string; name?: string; url?: string; mode?: string }>; error?: string }
    | null;
  if (!response.ok || !body?.runId) {
    return {
      ok: false,
      reason: body?.error ?? `recruit2_apply_${response.status}`,
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
