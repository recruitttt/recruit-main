import { readJson, readParams, routeError } from "../../../../_route-utils";
import { getApplyRunStore } from "@/lib/apply-service";

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
