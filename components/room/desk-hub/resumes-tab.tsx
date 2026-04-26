"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Download, FileText } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { TailoredPdfViewer } from "@/components/tailored-pdf-viewer";

type Props = { userId: string | null };

type TailoredAppRow = {
  _id: string;
  jobId?: string;
  company?: string;
  title?: string;
  status?: string;
  tailoringScore?: number;
  pdfReady?: boolean;
  pdfFilename?: string;
  pdfByteLength?: number;
};

function defaultFilename(row: TailoredAppRow): string {
  if (row.pdfFilename) return row.pdfFilename;
  const company = (row.company ?? "Tailored").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Resume_${company || "Tailored"}.pdf`;
}

export function ResumesTab({ userId }: Props) {
  const apps = useQuery(
    api.tailoredApplications.listForUser,
    userId ? { userId, limit: 25 } : "skip",
  ) as TailoredAppRow[] | undefined;

  const [viewing, setViewing] = useState<TailoredAppRow | null>(null);

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!apps) return <div className="text-gray-500">Loading…</div>;
  if (apps.length === 0)
    return <div className="text-gray-500">No tailored resumes yet. Tailor a job from the dashboard to populate this view.</div>;

  return (
    <>
      <div className="space-y-2">
        {apps.map((a) => {
          // Each row links to its OWN tailored PDF, served per-job by
          // /api/dashboard/resume-pdf — no shared static fallback.
          const downloadHref = a.jobId
            ? `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(a.jobId)}`
            : null;
          const filename = defaultFilename(a);
          return (
            <div key={a._id} className="p-2 border border-gray-200 rounded">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{a.title ?? "(role)"}</div>
                  <div className="text-xs text-gray-500 truncate">{a.company ?? "(company)"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {typeof a.tailoringScore === "number" && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      {Math.round(a.tailoringScore * 100)}%
                    </span>
                  )}
                  {a.jobId ? (
                    <button
                      type="button"
                      onClick={() => setViewing(a)}
                      className="inline-flex items-center gap-1 rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-700"
                      aria-label={`View tailored resume for ${a.company ?? "this company"}`}
                    >
                      <FileText className="h-3 w-3" /> View
                    </button>
                  ) : null}
                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      download={filename}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
                      aria-label={`Download tailored resume for ${a.company ?? "this company"}`}
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                      {a.status === "tailoring" ? "Tailoring…" : "PDF pending"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <TailoredPdfViewer
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        jobId={viewing?.jobId ?? null}
        filename={viewing?.pdfFilename}
        sizeKb={
          typeof viewing?.pdfByteLength === "number"
            ? Math.max(1, Math.round(viewing.pdfByteLength / 1024))
            : undefined
        }
      />
    </>
  );
}
