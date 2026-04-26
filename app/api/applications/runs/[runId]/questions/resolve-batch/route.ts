import { readJson, readParams, routeError } from "../../../../_route-utils";
import {
  getApplyRunStore,
  recruit2ApplyApiBaseUrl,
  type ApplyRun,
  type DeferredQuestionGroup,
} from "@/lib/apply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: { runId: string } | Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await readParams(context);
  const body = await readJson(req);
  if (!body.ok) return body.response;
  if (!isRecord(body.value) || !isRecord(body.value.answers)) {
    return Response.json({ ok: false, reason: "invalid_answers" }, { status: 400 });
  }

  const answers: Record<string, { answer: string; remember?: boolean; overrides?: Record<string, string> }> = {};
  for (const [groupId, raw] of Object.entries(body.value.answers)) {
    if (!isRecord(raw) || typeof raw.answer !== "string" || raw.answer.trim().length === 0) {
      return Response.json({ ok: false, reason: "invalid_answer", groupId }, { status: 400 });
    }
    answers[groupId] = {
      answer: raw.answer,
      remember: raw.remember === true,
      overrides: isStringRecord(raw.overrides) ? raw.overrides : undefined,
    };
  }

  try {
    const run = getApplyRunStore().getRun(runId);
    if (!run) return Response.json({ ok: false, reason: "run_not_found" }, { status: 404 });
    if (run.remoteRunId && run.source === "recruit2-api") {
      const baseUrl = recruit2ApplyApiBaseUrl();
      if (!baseUrl) return Response.json({ ok: false, reason: "missing_apply_engine_api_url" }, { status: 503 });
      const response = await fetch(`${baseUrl}/api/apply-lab/runs/${encodeURIComponent(run.remoteRunId)}/questions/resolve-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const remoteBody = await response.json().catch(() => null) as { ok?: boolean; groups?: unknown[]; error?: string } | null;
      if (!response.ok || remoteBody?.ok === false) {
        return Response.json(
          { ok: false, reason: remoteBody?.error ?? `apply_engine_questions_resolve_${response.status}` },
          { status: response.status },
        );
      }
      return Response.json({
        ok: true,
        groups: Array.isArray(remoteBody?.groups) ? remoteBody.groups.map((group) => mapRemoteQuestionGroup(group, run)) : [],
      });
    }

    const groups = getApplyRunStore().resolveQuestionBatch(runId, answers);
    return Response.json({ ok: true, groups });
  } catch (error) {
    return routeError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function mapRemoteQuestionGroup(raw: unknown, run: ApplyRun): DeferredQuestionGroup {
  const group = isRecord(raw) ? raw : {};
  const groupId = stringValue(group.groupId) || stringValue(group.id) || "remote-question";
  const targets = Array.isArray(group.targets) ? group.targets : [];
  const prompt = stringValue(group.displayQuestion) || stringValue(group.prompt) || "Answer needed before continuing";
  const provisionalAnswer = stringValue(group.provisionalValue) || stringValue(group.provisionalAnswer);
  const status = stringValue(group.status) === "resolved" ? "resolved" : "pending";
  return {
    id: groupId,
    semanticKey: stringValue(group.normalizedKey) || stringValue(group.semanticKey) || groupId,
    prompt,
    status,
    provisionalAnswer,
    answer: stringValue(group.resolvedValue) || undefined,
    remember: group.remember === true,
    requiresExplicitGate: stringValue(group.category) === "legal",
    items: targets.map((target, index) => mapRemoteQuestionTarget(target, run, groupId, prompt, provisionalAnswer, index)),
  };
}

function mapRemoteQuestionTarget(
  raw: unknown,
  run: ApplyRun,
  groupId: string,
  prompt: string,
  provisionalAnswer: string,
  index: number,
): DeferredQuestionGroup["items"][number] {
  const target = isRecord(raw) ? raw : {};
  const jobSlug = stringValue(target.jobSlug);
  const job = run.jobs.find((item) => item.remoteJobSlug === jobSlug) ?? run.jobs[index] ?? run.jobs[0];
  return {
    id: stringValue(target.id) || stringValue(target.recordId) || `${groupId}:${index}`,
    jobId: job?.id ?? jobSlug,
    jobTitle: job?.job.title,
    company: job?.job.company,
    prompt,
    provisionalAnswer: stringValue(target.provisionalValue) || provisionalAnswer,
    confidence: numberValue(target.confidence) ?? 0,
    category: stringValue(target.category) || undefined,
    options: stringArray(target.options),
    screenshotPng: stringValue(target.screenshotPng) || undefined,
    field: {
      label: stringValue(target.fieldLabel) || undefined,
      selector: stringValue(target.selector) || undefined,
    },
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}
