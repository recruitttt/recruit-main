"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TailoredPdfViewerProps = {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  filename?: string;
  sizeKb?: number;
  pdfBase64?: string | null;
};

function base64ToBlobUrl(base64: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function TailoredPdfViewer({
  open,
  onClose,
  jobId,
  filename,
  sizeKb,
  pdfBase64,
}: TailoredPdfViewerProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const blobUrl = useMemo(() => {
    if (!open || !pdfBase64) return null;
    return base64ToBlobUrl(pdfBase64);
  }, [open, pdfBase64]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const apiUrl = jobId
    ? `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(jobId)}&inline=1`
    : null;
  const downloadUrl = jobId
    ? `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(jobId)}`
    : null;
  const src = blobUrl ?? apiUrl;
  const iframeLoaded = Boolean(src && loadedSrc === src);
  const displayName = filename ?? "Tailored resume.pdf";

  function handleDownload() {
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (downloadUrl) {
      window.location.href = downloadUrl;
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div
            className="absolute inset-0 bg-[rgba(15,15,18,0.45)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${displayName}`}
            className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_64px_-16px_rgba(15,15,18,0.32)]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                  {displayName}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                  Tailored resume preview
                  {sizeKb ? ` · ${sizeKb} KB` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownload}
                  disabled={!src}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  aria-label="Close preview"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="relative flex-1 bg-[var(--color-surface-1)]">
              {!iframeLoaded && src && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--color-fg-subtle)]">
                  Loading preview…
                </div>
              )}
              {src ? (
                <iframe
                  key={src}
                  src={src}
                  title={displayName}
                  className="h-full w-full border-0"
                  onLoad={() => setLoadedSrc(src)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-[var(--color-fg-muted)]">
                  No PDF available yet.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
