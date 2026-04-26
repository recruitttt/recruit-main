/* eslint-disable @typescript-eslint/no-explicit-any */

import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

function unavailable() {
  return Response.json(
    {
      error: "missing_convex_url",
      message: "DLQ persistence needs Convex configuration.",
    },
    { status: 503 }
  );
}

export async function GET() {
  const client = getConvexClient();
  if (!client) return unavailable();

  try {
    const queue = await client.query((api as any).dlq.listDemoQueue, {});
    return Response.json(queue);
  } catch {
    return Response.json(
      { error: "dlq_load_failed", message: "Could not load the persisted queue." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const client = getConvexClient();
  if (!client) return unavailable();

  const body = await req.json().catch(() => null) as
    | { action?: string; itemId?: string; answer?: string }
    | null;

  if (!body?.itemId) {
    return Response.json(
      { error: "missing_item", message: "Choose a queue item first." },
      { status: 400 }
    );
  }

  try {
    if (body.action === "approve-cache") {
      await client.mutation((api as any).dlq.approveAndCache, {
        itemId: body.itemId,
        answer: body.answer ?? "",
      });
    } else if (body.action === "skip-role") {
      await client.mutation((api as any).dlq.skipRole, { itemId: body.itemId });
    } else if (body.action === "mark-resolved") {
      await client.mutation((api as any).dlq.markResolved, { itemId: body.itemId });
    } else {
      return Response.json(
        { error: "invalid_action", message: "Choose a valid queue action." },
        { status: 400 }
      );
    }

    const queue = await client.query((api as any).dlq.listDemoQueue, {});
    return Response.json({ ok: true, queue });
  } catch {
    return Response.json(
      { error: "dlq_update_failed", message: "Could not persist that DLQ decision." },
      { status: 500 }
    );
  }
}
