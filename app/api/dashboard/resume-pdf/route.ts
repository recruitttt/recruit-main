import { api } from "@/convex/_generated/api";
import { getSessionUserId } from "@/lib/auth-server";
import { getConvexClient } from "@/lib/convex-http";
import { isProfileUsable } from "@/lib/demo-profile";
import {
  omDemoJobDetail,
  omDemoTailoredPdf,
  shouldUseOmDemoData,
} from "@/lib/om-demo-data";
import type { UserProfile } from "@/lib/profile";
import { isResumeTemplateId } from "@/lib/resume-html";
import { tailorDemoJob } from "@/lib/tailor/demo-tailor";
import type { Job } from "@/lib/tailor/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfPayload = {
  filename?: string;
  base64?: string;
};

async function loadStoredProfile(userId: string | null): Promise<UserProfile | null> {
  if (!userId) return null;
  const client = await getConvexClient();
  if (!client) return null;
  try {
    const row = await client.query(api.userProfiles.byUser, { userId });
    const candidate = (row as { profile?: UserProfile } | null)?.profile;
    return isProfileUsable(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function pdfResponse(bytes: Uint8Array, filename: string, inline: boolean): Response {
  const disposition = inline ? "inline" : "attachment";
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  return new Response(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const demoUserId = url.searchParams.get("demoUserId") ?? undefined;
  const inline = url.searchParams.get("inline") === "1";
  const templateParam = url.searchParams.get("templateId");
  const templateId = isResumeTemplateId(templateParam) ? templateParam : "minimalist";
  if (!jobId) {
    return Response.json({ ok: false, reason: "missing_job" }, { status: 400 });
  }

  if (shouldUseOmDemoData()) {
    // Demo dashboard. If the signed-in user has a real profile in Convex,
    // generate a *real* tailored PDF on demand. Cache is held by jobId +
    // profile signature in `tailorDemoJob` so repeated downloads are cheap.
    const userId = await getSessionUserId().catch(() => null);
    const realProfile = await loadStoredProfile(userId);
    if (realProfile) {
      const detail = omDemoJobDetail(jobId);
      if (detail?.job) {
        const job: Job = {
          id: jobId,
          company: detail.job.company,
          role: detail.job.title,
          jobUrl: detail.job.jobUrl,
          location: detail.job.location,
          descriptionPlain: detail.job.descriptionPlain,
        };
        const tailored = await tailorDemoJob({
          jobId,
          job,
          profile: realProfile,
          profileSource: "convex",
          templateId,
        });
        if (tailored.ok) {
          const bytes = Uint8Array.from(Buffer.from(tailored.application.pdfBase64, "base64"));
          return pdfResponse(bytes, tailored.filename, inline);
        }
      }
    }

    // Fallback: static demo fixture PDF — only when no real profile exists.
    const demoPdf = omDemoTailoredPdf(jobId);
    if (!demoPdf) {
      return Response.json({ ok: false, reason: "pdf_not_found" }, { status: 404 });
    }
    const bytes = Uint8Array.from(Buffer.from(demoPdf.base64, "base64"));
    return pdfResponse(bytes, demoPdf.filename, inline);
  }

  // Live Convex dashboard — read the persisted PDF written by the tailor
  // pipeline.
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
    return pdfResponse(bytes, filename, inline);
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
