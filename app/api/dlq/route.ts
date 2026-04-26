/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";

function unavailable() {
  return Response.json(
    {
      error: "missing_convex_url",
      message: "Review queue persistence needs Convex configuration.",
    },
    { status: 503 }
  );
}

export async function GET() {
  const client = await getConvexClient();
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
  const client = await getConvexClient();
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
    } else if (body.action === "reset-test-fixture") {
      if (process.env.RECRUIT_E2E_FIXTURES !== "1") {
        return Response.json(
          { error: "fixtures_disabled", message: "Set RECRUIT_E2E_FIXTURES=1 to reset E2E DLQ fixtures." },
          { status: 403 }
        );
      }
      await client.mutation((api as any).dlq.resetDemoQueueItem, {
        itemId: body.itemId,
      });
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
      { error: "dlq_update_failed", message: "Could not persist that review decision." },
      { status: 500 }
    );
  }
}
