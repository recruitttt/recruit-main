import { readFile } from "node:fs/promises";

import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-http";
import { omDemoTailoredPdf, shouldUseOmDemoData } from "@/lib/om-demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Always serve this static PDF as the tailored-resume preview/download,
// regardless of which job the user clicked. Override path / filename via
// env so the same route still works in deploys where this local file is
// absent (it falls through to the regular Convex-backed flow on read fail).
const STATIC_RESUME_PATH =
  process.env.STATIC_TAILORED_RESUME_PATH ??
  "/Users/omsanan/Downloads/Important/Om Sanan_Resume_April_2026.pdf";
const STATIC_RESUME_FILENAME =
  process.env.STATIC_TAILORED_RESUME_FILENAME ??
  "Om Sanan Resume - April 2026.pdf";

type PdfPayload = {
  filename?: string;
  base64?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const demoUserId = url.searchParams.get("demoUserId") ?? undefined;
  const inline = url.searchParams.get("inline") === "1";
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job" }, { status: 400 });
  }

  // Static-resume override — every tailored-resume view/download serves
  // the same underlying PDF the user provided.
  try {
    const bytes = await readFile(STATIC_RESUME_PATH);
    const disposition = inline ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${STATIC_RESUME_FILENAME.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // File missing (e.g. running on a deployment where the absolute path
    // doesn't exist) — fall through to the regular Convex-backed flow.
  }

  if (shouldUseOmDemoData()) {
    const tailored = omDemoTailoredPdf(jobId);
    if (!tailored) {
      return Response.json({ ok: false, reason: "pdf_not_found" }, { status: 404 });
    }
    const bytes = Uint8Array.from(Buffer.from(tailored.base64, "base64"));
    const disposition = inline ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${tailored.filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const client = await getConvexClient();
  if (!client) {
    return Response.json({ ok: false, reason: "missing_convex_url" }, { status: 503 });
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
