"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Download, FileText } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { TailoredPdfViewer } from "@/components/tailored-pdf-viewer";
import { useRoomStore } from "../room-store";

type Props = { userId: string | null };

type ApplicationJobRow = {
  _id: string;
  jobId?: string;
  company?: string;
  title?: string;
  status: string;
  provider?: string;
  targetUrl?: string;
};

type TailoredAppRow = {
  _id: string;
  jobId?: string;
  pdfReady?: boolean;
  pdfFilename?: string;
  pdfByteLength?: number;
};

const STATUS_CLASSES: Record<string, string> = {
  queued: "bg-gray-100 text-gray-700",
  claimed: "bg-blue-100 text-blue-700",
  fill_in_progress: "bg-blue-100 text-blue-700",
  filled_verified: "bg-green-100 text-green-700",
  submit_attempted: "bg-amber-100 text-amber-700",
  submitted_confirmed: "bg-green-100 text-green-700",
  submitted_probable: "bg-green-100 text-green-700",
  waiting_for_user_input: "bg-amber-100 text-amber-700",
};

function statusClass(status: string): string {
  if (STATUS_CLASSES[status]) return STATUS_CLASSES[status];
  if (status.startsWith("failed_")) return "bg-rose-100 text-rose-700";
  return "bg-gray-100 text-gray-700";
}

type ViewingTarget = {
  jobId: string;
  filename?: string;
  sizeKb?: number;
};

export function ApplyQueueTab({ userId }: Props) {
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const jobs = useQuery(
    api.applicationJobs.listRecentForCurrentUser,
    userId ? { limit: 25 } : "skip",
  ) as ApplicationJobRow[] | undefined;
  const tailored = useQuery(
    api.tailoredApplications.listForUser,
    userId ? { userId, limit: 100 } : "skip",
  ) as TailoredAppRow[] | undefined;

  const tailoredByJobId = useMemo(() => {
    const map = new Map<string, TailoredAppRow>();
    for (const t of tailored ?? []) {
      if (t.jobId && t.pdfReady) map.set(t.jobId, t);
    }
    return map;
  }, [tailored]);

  const [viewing, setViewing] = useState<ViewingTarget | null>(null);

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!jobs) return <div className="text-gray-500">Loading…</div>;
  if (jobs.length === 0)
    return (
      <div className="space-y-3">
        <div className="text-gray-500 text-sm">No applications queued.</div>
        <button
          onClick={() => setTerminalActive(true)}
          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded"
        >
          Open Terminal
        </button>
      </div>
    );

  return (
    <>
      <div className="space-y-2">
        {jobs.map((j) => {
          const tailoredApp = j.jobId ? tailoredByJobId.get(j.jobId) : undefined;
          const downloadHref = tailoredApp?.jobId
            ? `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(tailoredApp.jobId)}`
            : null;
          return (
            <div
              key={j._id}
              className="p-3 border border-gray-200 rounded flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{j.title ?? "(role)"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {j.company ?? "(company)"}
                  {j.provider ? ` · ${j.provider}` : ""}
                </div>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 mt-1 rounded ${statusClass(j.status)}`}>
                  {j.status}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tailoredApp && tailoredApp.jobId && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setViewing({
                          jobId: tailoredApp.jobId!,
                          filename: tailoredApp.pdfFilename,
                          sizeKb:
                            typeof tailoredApp.pdfByteLength === "number"
                              ? Math.max(1, Math.round(tailoredApp.pdfByteLength / 1024))
                              : undefined,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-700"
                      aria-label={`View tailored resume for ${j.company ?? "this company"}`}
                    >
                      <FileText className="h-3 w-3" /> View Resume
                    </button>
                    {downloadHref && (
                      <a
                        href={downloadHref}
                        download={tailoredApp.pdfFilename ?? "tailored-resume.pdf"}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
                        aria-label={`Download tailored resume for ${j.company ?? "this company"}`}
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    )}
                  </>
                )}
                <button
                  onClick={() => setTerminalActive(true)}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded"
                >
                  Open Terminal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <TailoredPdfViewer
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        jobId={viewing?.jobId ?? null}
        filename={viewing?.filename}
        sizeKb={viewing?.sizeKb}
      />
    </>
  );
}
