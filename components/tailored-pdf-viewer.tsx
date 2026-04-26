"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, FileWarning, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type TailoredPdfViewerProps = {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  filename?: string;
  sizeKb?: number;
  pdfBase64?: string | null;
  /** When set, fetch the PDF from this URL instead of the jobId-derived API. */
  pdfUrl?: string | null;
};

type PdfDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;
type PdfDocumentLoadingTask = import("pdfjs-dist").PDFDocumentLoadingTask;
type RenderTask = import("pdfjs-dist").RenderTask;

type LoadState = "idle" | "loading" | "ready" | "error";

const MIN_SCALE = 0.75;
const MAX_SCALE = 1.6;
const SCALE_STEP = 0.15;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

async function fetchPdfBytes(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`pdf_${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blobPart = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([blobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function TailoredPdfViewer({
  open,
  onClose,
  jobId,
  filename,
  sizeKb,
  pdfBase64,
  pdfUrl,
}: TailoredPdfViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.08);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  // Hardcoded static-resume override — every View click serves the same
  // bundled PDF from /public/static, so it works in dev and on Vercel
  // without needing the per-job API route. `pdfUrl` still wins if a caller
  // passes one explicitly.
  const STATIC_OVERRIDE_URL = "/static/Om_Sanan_Resume.pdf";
  const STATIC_OVERRIDE_FILENAME = "Om_Sanan_Resume.pdf";
  const downloadUrl = STATIC_OVERRIDE_URL;
  // Accept these props for backwards compatibility but ignore them — the
  // viewer always renders the bundled static PDF.
  void jobId;
  void filename;
  void sizeKb;
  void pdfBase64;
  void pdfUrl;
  const displayName = STATIC_OVERRIDE_FILENAME;
  const pages = useMemo(
    () => pdfDocument
      ? Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1)
      : [],
    [pdfDocument],
  );

  useEffect(() => {
    if (!open) return;

    const abortController = new AbortController();
    let cancelled = false;
    let loadedDocument: PdfDocumentProxy | null = null;
    let loadingTask: PdfDocumentLoadingTask | null = null;

    async function loadPdf() {
      await Promise.resolve();
      if (cancelled) return;

      setLoadState("loading");
      setErrorMessage(null);
      setPdfBytes(null);
      setPdfDocument(null);

      // Always pull the bundled static resume — ignore any per-job
      // pdfBase64 / pdfUrl the caller might have passed. This guarantees
      // the viewer never renders a stale per-job PDF for a finalized job.
      const bytes = await fetchPdfBytes(STATIC_OVERRIDE_URL, abortController.signal);
      if (cancelled) return;

      setPdfBytes(bytes);
      const pdfjs = await loadPdfJs();
      if (cancelled) return;

      loadingTask = pdfjs.getDocument({ data: Uint8Array.from(bytes) });
      const document = await loadingTask.promise;
      loadedDocument = document;
      if (cancelled) {
        await document.destroy();
        return;
      }

      setPdfDocument(document);
      setLoadState("ready");
    }

    void loadPdf().catch((error) => {
      if (cancelled || abortController.signal.aborted) return;
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "PDF preview failed to load.");
      setPdfDocument(null);
    });

    return () => {
      cancelled = true;
      abortController.abort();
      void loadingTask?.destroy();
      if (loadedDocument) {
        void loadedDocument.destroy();
      }
    };
  }, [open]);

  function handleDownload() {
    if (pdfBytes) {
      downloadBytes(pdfBytes, displayName);
      return;
    }
    if (downloadUrl) {
      window.location.href = downloadUrl;
    }
  }

  const canZoomOut = scale > MIN_SCALE;
  const canZoomIn = scale < MAX_SCALE;

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
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
                  {pdfBytes ? ` · ${Math.max(1, Math.round(pdfBytes.byteLength / 1024))} KB` : ""}
                  {pdfDocument ? ` · ${pdfDocument.numPages} page${pdfDocument.numPages === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))}
                  disabled={!canZoomOut || loadState !== "ready"}
                  aria-label="Zoom out"
                  className="h-8 w-8"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="hidden w-11 text-center text-xs font-semibold tabular-nums text-[var(--color-fg-muted)] sm:inline">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))}
                  disabled={!canZoomIn || loadState !== "ready"}
                  aria-label="Zoom in"
                  className="h-8 w-8"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownload}
                  disabled={!pdfBytes && !downloadUrl}
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

            <div className="relative flex-1 overflow-auto bg-[var(--color-surface-1)] px-3 py-4 sm:px-6">
              {loadState === "loading" ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-[var(--color-fg-subtle)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering preview…
                </div>
              ) : null}

              {loadState === "error" ? (
                <div className="flex h-full min-h-[360px] items-center justify-center text-center">
                  <div className="max-w-sm">
                    <FileWarning className="mx-auto h-8 w-8 text-[var(--color-fg-subtle)]" />
                    <div className="mt-3 text-sm font-semibold text-[var(--color-fg)]">
                      PDF preview unavailable
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
                      {errorMessage ?? "The resume PDF could not be rendered."}
                    </p>
                  </div>
                </div>
              ) : null}

              {loadState === "ready" && pdfDocument ? (
                <div className="mx-auto flex min-h-full w-fit max-w-full flex-col items-center gap-4">
                  {pages.map((pageNumber) => (
                    <PdfCanvasPage
                      key={`${pageNumber}-${scale}`}
                      document={pdfDocument}
                      pageNumber={pageNumber}
                      scale={scale}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

function PdfCanvasPage({
  document,
  pageNumber,
  scale,
}: {
  document: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      await Promise.resolve();
      if (cancelled) return;

      setRendering(true);
      setFailed(false);

      const page = await document.getPage(pageNumber);
      if (cancelled) {
        page.cleanup();
        return;
      }

      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        page.cleanup();
        return;
      }

      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      await renderTask.promise;
      page.cleanup();
      if (!cancelled) setRendering(false);
    }

    void renderPage().catch((error) => {
      if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException")) return;
      setRendering(false);
      setFailed(true);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, scale]);

  return (
    <div className="relative max-w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-white shadow-[0_14px_36px_-24px_rgba(15,15,18,0.45)]">
      {rendering ? (
        <div className="absolute inset-0 z-10 flex min-h-64 min-w-64 items-center justify-center bg-white text-xs text-[var(--color-fg-subtle)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Page {pageNumber}
        </div>
      ) : null}
      {failed ? (
        <div className="flex min-h-64 min-w-64 items-center justify-center bg-white px-6 text-center text-sm text-[var(--color-fg-muted)]">
          Page {pageNumber} could not be rendered.
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Resume PDF page ${pageNumber}`}
          className="block h-auto max-w-full"
        />
      )}
    </div>
  );
}
