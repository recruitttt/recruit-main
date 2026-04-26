// Resume intake — Next.js route handler.
//
// This route mirrors the Convex `runResumeIntake` action but streams SSE
// progress directly to the browser. The shared parser uses unpdf's serverless
// pdfjs bundle, so both the route and the Convex action avoid `pdf.worker.mjs`.
//
// Pipeline (mirrors the previous `runResumeIntake` Convex action):
//   1. Resolve the better-auth session → userId.        (401 on miss)
//   2. Validate `{ fileId, filename? }` body.           (400 on miss/invalid)
//   3. Pull the PDF blob from Convex `_storage` via the public URL helper.
//   4. Build a `ConvexHttpClient` so the adapter can read/write Convex.
//   5. Stream SSE events back to the browser as the adapter progresses.
//      Every event is also persisted into `intakeRuns` by `runIntake`, so
//      the existing `useQuery(api.intakeRuns.byUserKind, ...)` badges in
//      the onboarding page keep updating live.

import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getSessionUserId, getToken } from "@/lib/auth-server";
import { resumeAdapter } from "@/lib/intake/resume/adapter";
import { runIntake } from "@/lib/intake/shared/runIntake";
import { convexHttpClientToCtx } from "@/lib/intake/shared/runIntakeNode";
import { createSseWriter } from "@/lib/intake/shared/sse";
import type {
  AICredentials,
  IntakeAdapter,
  IntakeContext,
  IntakeConvexCtx,
} from "@/lib/intake/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// LLM extraction can take up to ~15s; 60s ceiling is generous.
export const maxDuration = 60;

const RequestSchema = z.object({
  fileId: z.string().min(1),
  filename: z.string().optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

function resolveAICredentials(): AICredentials {
  const gateway = process.env.AI_GATEWAY_API_KEY;
  if (gateway) return { source: "gateway", apiKey: gateway };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { source: "anthropic", apiKey: anthropic };
  // Resume LLM step uses OPENAI_API_KEY directly; non-fatal if missing.
  return { source: "anthropic", apiKey: "" };
}

function buildConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is required for the resume intake route.",
    );
  }
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

function sseHeaders(): HeadersInit {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  };
}

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

// Fetch the PDF blob from Convex storage. The route handler can't call
// `ctx.storage.get` directly (that's only available inside Convex actions),
// so we resolve the storage id to a signed URL via `api.files.getUrl` and
// fetch it like any other public resource.
async function fetchStorageBlob(
  client: ConvexHttpClient,
  fileId: string,
): Promise<Blob> {
  const url = (await client.query(api.files.getUrl, {
    storageId: fileId as Id<"_storage">,
  })) as string | null;
  if (!url) throw new Error("resume_file_missing");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `resume_file_fetch_failed: ${response.status} ${response.statusText}`,
    );
  }
  return await response.blob();
}

// Build an IntakeConvexCtx whose `storage.get(fileId)` returns the
// pre-fetched blob. The resume adapter calls `ctx.ctx.storage.get(input.fileId)`
// once and only for the file it just received, so a single-blob stub is
// sufficient here.
function ctxWithBlob(
  client: ConvexHttpClient,
  preloadedFileId: string,
  blob: Blob,
): IntakeConvexCtx {
  const base = convexHttpClientToCtx(client);
  return {
    ...base,
    storage: {
      get: async (id: unknown) => {
        if (id !== preloadedFileId) {
          throw new Error(
            `Resume route preloaded fileId ${preloadedFileId}, but adapter requested ${String(id)}.`,
          );
        }
        return blob;
      },
    },
  };
}

export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return jsonError("unauthorized", 401);

  let body: RequestBody;
  try {
    const json: unknown = await req.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid request";
    return jsonError(msg, 400);
  }

  let client: ConvexHttpClient;
  let credentials: AICredentials;
  try {
    client = buildConvexClient();
    credentials = resolveAICredentials();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "configuration error";
    return jsonError(msg, 503);
  }

  // Forward the better-auth token so Convex mutations execute as the user.
  try {
    const token = await getToken();
    if (token) client.setAuth(token);
  } catch {
    // Mutations targeted by this route accept `userId` arg; auth optional.
  }

  // Pre-fetch the PDF before we start streaming so we can fail fast with a
  // proper HTTP error if storage is unreachable. The streamed events only
  // start once we know the file is in hand.
  let blob: Blob;
  try {
    blob = await fetchStorageBlob(client, body.fileId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 422);
  }

  const stream = streamResumeIntake({
    fileId: body.fileId,
    filename: body.filename,
    userId,
    client,
    credentials,
    blob,
    signal: req.signal,
  });

  return new Response(stream, { headers: sseHeaders() });
}

interface StreamInput {
  fileId: string;
  filename?: string;
  userId: string;
  client: ConvexHttpClient;
  credentials: AICredentials;
  blob: Blob;
  signal?: AbortSignal;
}

function streamResumeIntake({
  fileId,
  filename,
  userId,
  client,
  credentials,
  blob,
  signal,
}: StreamInput): ReadableStream<Uint8Array> {
  let writer: ReturnType<typeof createSseWriter> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const streamWriter = createSseWriter(controller);
      writer = streamWriter;
      const onAbort = () => streamWriter.cancel();
      signal?.addEventListener("abort", onAbort, { once: true });

      const tappedAdapter: IntakeAdapter<{
        fileId: Id<"_storage">;
        filename?: string;
      }> = {
        name: resumeAdapter.name,
        async *run(input, ctx) {
          for await (const event of resumeAdapter.run(input, ctx)) {
            streamWriter.send(event);
            yield event;
          }
        },
      };

      const intakeCtx: IntakeContext = {
        userId,
        ctx: ctxWithBlob(client, fileId, blob),
        credentials,
        now: () => new Date().toISOString(),
      };

      try {
        await runIntake(
          tappedAdapter,
          { fileId: fileId as Id<"_storage">, filename },
          intakeCtx,
        );
        streamWriter.send({ stage: "complete", message: "Resume intake complete" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        streamWriter.send({ stage: "error", level: "error", error: message });
      } finally {
        signal?.removeEventListener("abort", onAbort);
        streamWriter.close();
      }
    },
    cancel() {
      writer?.cancel();
    },
  });
}
