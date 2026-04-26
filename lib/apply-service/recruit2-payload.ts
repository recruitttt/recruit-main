import { toRecruit2Profile } from "./profile";
import type { NormalizedApplyBatch, Recruit2ApplyPayload, TailoredResume } from "./types";

export function buildRecruit2ApplyPayload(batch: NormalizedApplyBatch): Recruit2ApplyPayload {
  const primaryResume = selectPrimaryResume(batch);
  return {
    targets: batch.jobs.map((job) => ({
      kind: "external",
      url: job.applicationUrl ?? job.url,
      company: job.company,
      title: job.title,
      mode: batch.settings.mode,
      approval: { externalTargetApproved: true },
    })),
    profile: toRecruit2Profile(batch.profile, {
      resume: primaryResume,
      resumesByJob: batch.tailoredResumes,
    }),
    settings: {
      defaultMode: batch.settings.mode,
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

function selectPrimaryResume(batch: NormalizedApplyBatch): TailoredResume | null {
  for (const job of batch.jobs) {
    const resume = batch.tailoredResumes[job.id];
    if (resume) return resume;
  }
  return Object.values(batch.tailoredResumes)[0] ?? null;
}
