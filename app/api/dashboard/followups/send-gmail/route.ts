import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const client = getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.taskId) {
    return Response.json({ ok: false, reason: "missing_task_id" }, { status: 400 });
  }
  const result = await client.action(api.followupActions.sendApprovedFollowUpWithGmail, {
    taskId: body.taskId as never,
  });
  return Response.json(result);
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}
