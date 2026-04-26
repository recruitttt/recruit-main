"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Minimize2, RefreshCw, X } from "lucide-react";

export type CloudBrowserViewProps = {
  liveViewUrl: string | null;
  /** Caption shown in the header — e.g. "LinkedIn intake". */
  source?: string;
  /** Indicates the user needs to interact with the embedded browser. */
  needsAssistance?: boolean;
  /** Called when the user dismisses the viewer. Optional. */
  onClose?: () => void;
};

export function CloudBrowserView({
  liveViewUrl,
  source = "Cloud browser",
  needsAssistance = false,
  onClose,
}: CloudBrowserViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <AnimatePresence>
      {liveViewUrl ? (
        <motion.div
          key={liveViewUrl}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={
            expanded
              ? "fixed inset-0 z-[60] flex items-center justify-center bg-[#101827]/55 p-6 backdrop-blur-md"
              : "fixed bottom-5 right-5 z-50 w-[420px] max-w-[calc(100vw-32px)]"
          }
        >
          <div
            className={
              "flex flex-col overflow-hidden rounded-[20px] border border-white/55 bg-[#F8FBFF]/96 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.32),0_12px_32px_-16px_rgba(15,23,42,0.18)] backdrop-blur-2xl " +
              (expanded ? "h-[min(82vh,820px)] w-[min(1200px,calc(100vw-48px))]" : "")
            }
          >
            <div className="flex items-center justify-between border-b border-white/45 px-3.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (needsAssistance ? "bg-amber-500 animate-pulse" : "bg-emerald-500")
                  }
                  style={{
                    boxShadow: needsAssistance
                      ? "0 0 8px rgba(245, 158, 11, 0.55)"
                      : "0 0 8px rgba(16, 185, 129, 0.5)",
                  }}
                />
                <div className="min-w-0">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#6B7A90]">
                    {needsAssistance ? "needs you" : "cloud browser · live"}
                  </div>
                  <div className="truncate text-[12px] font-medium text-[#101827]">
                    {source}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  aria-label="Reload embedded browser"
                  title="Reload"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B7A90] transition hover:bg-white/60 hover:text-[#101827]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  title={expanded ? "Collapse" : "Expand"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B7A90] transition hover:bg-white/60 hover:text-[#101827]"
                >
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    title="Close"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B7A90] transition hover:bg-white/60 hover:text-[#101827]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div
              className={
                "relative flex-1 bg-[#0B1220] " +
                (expanded ? "" : "aspect-[16/10] w-full")
              }
            >
              <iframe
                key={reloadKey}
                ref={iframeRef}
                src={liveViewUrl}
                className="absolute inset-0 h-full w-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                allow="clipboard-write; microphone; camera"
                title={`${source} — embedded cloud browser`}
              />
            </div>
            {needsAssistance ? (
              <div className="border-t border-white/45 bg-amber-50/70 px-3.5 py-2 text-[11.5px] text-amber-900">
                Click into the embedded browser to finish sign-in. The pipeline
                will resume automatically once you&apos;re through.
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
