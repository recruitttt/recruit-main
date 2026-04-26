import { toRecruit2Profile } from "./profile";
import type { ApplyMode, NormalizedApplyBatch, Recruit2ApplyMode, Recruit2ApplyPayload, TailoredResume } from "./types";

export function buildRecruit2ApplyPayload(batch: NormalizedApplyBatch): Recruit2ApplyPayload {
  const primaryResume = selectPrimaryResume(batch);
  const recruit2Mode = toRecruit2Mode(batch.settings.mode);
  return {
    targets: batch.jobs.map((job) => ({
      kind: "external",
      url: job.applicationUrl ?? job.url,
      company: job.company,
      title: job.title,
      mode: recruit2Mode,
      approval: { externalTargetApproved: true },
    })),
    profile: toRecruit2Profile(batch.profile, {
      resume: primaryResume,
      resumesByJob: batch.tailoredResumes,
    }),
    settings: {
      defaultMode: recruit2Mode,
      maxApplicationsPerRun: batch.settings.maxApplicationsPerRun,
      maxConcurrentApplications: batch.settings.maxConcurrentApplications,
      maxConcurrentPerDomain: batch.settings.maxConcurrentPerDomain,
      computerUseModel: batch.settings.computerUseModel,
      fillerModel: batch.settings.computerUseModel,
      liaisonModel: "gpt-5.4-nano",
      reviewerModel: "gpt-5.4-nano",
      autoSubmit: batch.consent.finalSubmitApproved === true && !batch.settings.devSkipRealSubmit,
    },
  };
}

function toRecruit2Mode(mode: ApplyMode): Recruit2ApplyMode {
  return mode === "hands-free" ? "autonomous" : mode;
}

function selectPrimaryResume(batch: NormalizedApplyBatch): TailoredResume | null {
  for (const job of batch.jobs) {
    const resume = batch.tailoredResumes[job.id];
    if (resume) return resume;
  }
  return Object.values(batch.tailoredResumes)[0] ?? null;
}
