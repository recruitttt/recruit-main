import { readParams, routeError } from "../../../_route-utils";
import {
  getApplyRunStore,
  recruit2ApplyApiBaseUrl,
} from "@/lib/apply-service";
import { getConvexClient } from "@/lib/convex-http";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobActionContext = {
  params: { runId: string } | Promise<{ runId: string }>;
};

export async function GET(req: Request, context: JobActionContext): Promise<Response> {
  const { runId } = await readParams(context);
  const search = new URL(req.url).searchParams;
  const action = search.get("action") ?? "screenshot";
  if (action !== "screenshot") {
    return Response.json({ ok: false, reason: "invalid_action" }, { status: 400 });
  }
  return screenshotResponse(runId, search);
}

export async function POST(req: Request, context: JobActionContext): Promise<Response> {
  const { runId } = await readParams(context);
  const search = new URL(req.url).searchParams;
  const action = search.get("action");
  const jobId = search.get("jobId")?.trim();
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job_id" }, { status: 400 });
  }

  try {
    if (action === "approve") return approveResponse(req, runId, jobId);
    if (action === "cancel") return cancelResponse(runId, jobId);
    if (action === "focus") return focusResponse(req, runId, jobId);
    return Response.json({ ok: false, reason: "invalid_action" }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}

async function approveResponse(req: Request, runId: string, jobId: string): Promise<Response> {
  const body = await optionalJson(req);
  const devSkipRealSubmit = isRecord(body) && typeof body.devSkipRealSubmit === "boolean"
    ? body.devSkipRealSubmit
    : undefined;
  const job = getApplyRunStore().approveJob(runId, jobId, { devSkipRealSubmit });
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  return Response.json({ ok: true, job });
}

function cancelResponse(runId: string, jobId: string): Response {
  const job = getApplyRunStore().cancelJob(runId, jobId);
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  return Response.json({ ok: true, job });
}

async function focusResponse(req: Request, runId: string, jobId: string): Promise<Response> {
  const body = await optionalJson(req);
  const run = getApplyRunStore().getRun(runId);
  if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  const job = run.jobs.find((item) => item.id === jobId);
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (!job.remoteRunId || !job.remoteJobSlug) {
    return Response.json({ ok: false, reason: "remote_job_not_ready" }, { status: 409 });
  }

  if (run.source === "recruit2-api") {
    const baseUrl = recruit2ApplyApiBaseUrl();
    if (!baseUrl) return Response.json({ ok: false, reason: "missing_apply_engine_api_url" }, { status: 503 });

    const upstream = await fetch(
      `${baseUrl}/api/apply-lab/runs/${encodeURIComponent(job.remoteRunId)}/jobs/${encodeURIComponent(job.remoteJobSlug)}/focus`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  }

  const screenshot = await latestConvexSnapshot(job.remoteJobSlug);
  if (screenshot.ok) {
    return jsonNoStore({ ...screenshot.body, focusUnavailable: true }, screenshot.status);
  }
  return jsonNoStore(
    { ok: false, reason: "focus_unavailable_for_convex_engine" },
    { status: 409 },
  );
}

async function screenshotResponse(runId: string, search: URLSearchParams): Promise<Response> {
  const jobId = search.get("jobId")?.trim();
  const fallbackConvexJobId = search.get("convexJobId")?.trim();
  const run = getApplyRunStore().getRun(runId);
  const job = jobId && run ? run.jobs.find((item) => item.id === jobId) ?? null : null;
  if (run && jobId && !job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (!run && !fallbackConvexJobId) {
    return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  }

  const convexJobId = job?.remoteJobSlug ?? fallbackConvexJobId;
  if (!convexJobId) {
    return Response.json({ ok: false, reason: "no_convex_job_id" }, { status: 409 });
  }

  const screenshot = await latestConvexSnapshot(convexJobId);
  if (!screenshot.ok) return screenshot.response;
  return jsonNoStore(screenshot.body, screenshot.status);
}

async function latestConvexSnapshot(convexJobId: string): Promise<
  | {
      ok: true;
      status?: ResponseInit;
      body: {
        ok: boolean;
        reason?: string;
        screenshotPng?: string;
        label?: string;
        createdAt?: string | number;
        jobStatus?: string;
        checkpoint?: string;
        error?: string;
        updatedAt?: string;
      };
    }
  | { ok: false; response: Response }
> {
  const client = await getConvexClient();
  if (!client) {
    return {
      ok: false,
      response: jsonNoStore({ ok: false, reason: "missing_convex_url" }, { status: 503 }),
    };
  }

  try {
    const [job, screenshot] = await Promise.all([
      client.query(api.applicationJobs.getApplicationJob, { jobId: convexJobId as never }),
      client.query(api.applicationJobs.getLatestScreenshot, { jobId: convexJobId as never }),
    ]);
    const metadata = job && typeof job === "object"
      ? {
          jobStatus: stringValue((job as { status?: unknown }).status),
          checkpoint: stringValue((job as { lastCheckpoint?: unknown }).lastCheckpoint),
          error: stringValue((job as { error?: unknown }).error),
          updatedAt: stringValue((job as { updatedAt?: unknown }).updatedAt),
        }
      : {};
    if (!screenshot?.pngBase64) {
      return {
        ok: true,
        status: { status: 202 },
        body: {
          ok: false,
          reason: "no_screenshot",
          ...metadata,
        },
      };
    }
    return {
      ok: true,
      body: {
        ok: true,
        screenshotPng: screenshot.pngBase64,
        label: screenshot.label,
        createdAt: screenshot.createdAt,
        ...metadata,
      },
    };
  } catch (error) {
    return {
      ok: false,
      response: jsonNoStore(
        { ok: false, reason: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      ),
    };
  }
}

async function optionalJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonNoStore(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
