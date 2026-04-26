"use client";

import type * as React from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence } from "motion/react";
import {
  ActionButton,
  FileUploadControl,
  cx,
  mistRadii,
} from "@/components/design-system";
import { ProgressBadge } from "@/components/onboarding/progress-badge";
import { ResumeFold } from "@/components/onboarding/resume-fold";
import type {
  Data,
  DataUpdate,
  IntakeRunRow,
  Step,
} from "@/app/onboarding/_data";

export function ResumeStepCard({
  data,
  parsingResume,
  resumeError,
  fileInputRef,
  resumeRun,
  onResumeFile,
  onAdvance,
  updateData,
}: {
  data: Data;
  parsingResume: boolean;
  resumeError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  resumeRun: IntakeRunRow;
  onResumeFile: (file: File | null) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
  updateData: (updates: DataUpdate) => void;
}) {
  const hasUpload = Boolean(data.resumeFilename);
  const hasFinishedRun =
    resumeRun?.status === "completed" || resumeRun?.status === "failed";
  // Show the fold animation while we're either uploading the file or the
  // server-side parse is still running. Once the run finishes, fall back to
  // the regular FileUploadControl + ProgressBadge view.
  const runActive =
    resumeRun?.status === "queued" || resumeRun?.status === "running";
  const showFold = parsingResume || (hasUpload && runActive);

  return (
    <div className="mt-2 space-y-4">
      <AnimatePresence mode="wait" initial={false}>
        {showFold ? (
          <ResumeFold key="fold" filename={data.resumeFilename || undefined} />
        ) : (
          <FileUploadControl
            key="upload"
            fileName={data.resumeFilename || undefined}
            parsing={parsingResume}
            onBrowse={() => fileInputRef.current?.click()}
            onClear={
              data.resumeFilename
                ? () =>
                    updateData({
                      resumeFilename: "",
                      resumeStorageId: null,
                    })
                : undefined
            }
          />
        )}
      </AnimatePresence>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => onResumeFile(e.target.files?.[0] ?? null)}
      />

      {resumeError && (
        <div
          className={cx(
            "border border-red-200/70 bg-red-50/50 px-3 py-2 text-xs text-red-700",
            mistRadii.nested,
          )}
        >
          {resumeError}
        </div>
      )}

      {!showFold && hasUpload && resumeRun && (
        <ProgressBadge kind="resume" run={resumeRun} />
      )}

      <div className="flex justify-end">
        <ActionButton
          variant={hasUpload ? "primary" : "secondary"}
          disabled={parsingResume}
          onClick={() =>
            onAdvance(
              hasUpload
                ? `Uploaded ${data.resumeFilename}`
                : "Skipped resume for now",
              "connect",
            )
          }
        >
          {hasUpload
            ? hasFinishedRun
              ? "Continue"
              : "Continue while parsing"
            : "Skip for now"}
          <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </div>
  );
}
