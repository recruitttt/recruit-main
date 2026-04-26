import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";

export const dynamic = "force-dynamic";

type PdfPayload = {
  filename?: string;
  base64?: string;
};

export async function GET(req: Request) {
  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const demoUserId = url.searchParams.get("demoUserId") ?? undefined;
  const inline = url.searchParams.get("inline") === "1";
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job" }, { status: 400 });
  }

  try {
    const detail = await client.query(api.ashby.jobDetail, {
      jobId: jobId as never,
      ...(demoUserId ? { demoUserId } : {}),
    });
    const application = detail?.tailoredApplication as
      | { pdfBase64?: string; pdfFilename?: string }
      | undefined;
    const pdfArtifact = (detail?.artifacts as Array<{ kind: string; payload?: unknown }> | undefined)
      ?.find((artifact) => artifact.kind === "pdf_file");
    const artifactPayload = pdfArtifact?.payload as PdfPayload | undefined;
    const base64 = application?.pdfBase64 ?? artifactPayload?.base64;
    const filename = application?.pdfFilename ?? artifactPayload?.filename ?? "TailoredResume.pdf";

    if (!base64) {
      return Response.json({ ok: false, reason: "pdf_not_found" }, { status: 404 });
    }

    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const disposition = inline ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
