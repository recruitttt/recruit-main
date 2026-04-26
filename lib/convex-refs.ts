import { makeFunctionReference } from "convex/server";

export const convexRefs = {
  ashby: {
    enabledAshbySources: makeFunctionReference<"query">(
      "ashby:enabledAshbySources"
    ),
    latestIngestionRunSummary: makeFunctionReference<"query">(
      "ashby:latestIngestionRunSummary"
    ),
    currentRecommendations: makeFunctionReference<"query">(
      "ashby:currentRecommendations"
    ),
    jobDetail: makeFunctionReference<"query">("ashby:jobDetail"),
    getAshbyRuntimeProfileContext: makeFunctionReference<"query">(
      "ashby:getAshbyRuntimeProfileContext"
    ),
    upsertDemoProfileSnapshot: makeFunctionReference<"mutation">(
      "ashby:upsertDemoProfileSnapshot"
    ),
    upsertTailoredApplication: makeFunctionReference<"mutation">(
      "ashby:upsertTailoredApplication"
    ),
    upsertAshbyApprovedAnswer: makeFunctionReference<"mutation">(
      "ashby:upsertAshbyApprovedAnswer"
    ),
    approveAshbyPendingReview: makeFunctionReference<"mutation">(
      "ashby:approveAshbyPendingReview"
    ),
  },
  ashbyActions: {
    seedAshbySourcesFromCareerOps: makeFunctionReference<"action">(
      "ashbyActions:seedAshbySourcesFromCareerOps"
    ),
    seedAtsSourcesFromCareerOps: makeFunctionReference<"action">(
      "ashbyActions:seedAtsSourcesFromCareerOps"
    ),
    runAshbyIngestion: makeFunctionReference<"action">(
      "ashbyActions:runAshbyIngestion"
    ),
    runAshbyFormFill: makeFunctionReference<"action">(
      "ashbyActions:runAshbyFormFill"
    ),
    runGreenhouseIngestion: makeFunctionReference<"action">(
      "ashbyActions:runGreenhouseIngestion"
    ),
    runLeverIngestion: makeFunctionReference<"action">(
      "ashbyActions:runLeverIngestion"
    ),
    runWorkdayIngestion: makeFunctionReference<"action">(
      "ashbyActions:runWorkdayIngestion"
    ),
    runAtsIngestion: makeFunctionReference<"action">(
      "ashbyActions:runAtsIngestion"
    ),
    rankIngestionRun: makeFunctionReference<"action">(
      "ashbyActions:rankIngestionRun"
    ),
  },
  applicationJobs: {
    createApplicationJob: makeFunctionReference<"mutation">(
      "applicationJobs:createApplicationJob"
    ),
    getApplicationJob: makeFunctionReference<"query">(
      "applicationJobs:getApplicationJob"
    ),
  },
  applicationActions: {
    runApplicationJob: makeFunctionReference<"action">(
      "applicationActions:runApplicationJob"
    ),
  },
  followups: {
    listApplications: makeFunctionReference<"query">(
      "followups:listApplications"
    ),
    listDueFollowUps: makeFunctionReference<"query">(
      "followups:listDueFollowUps"
    ),
    followUpSummary: makeFunctionReference<"query">(
      "followups:followUpSummary"
    ),
    upsertApplication: makeFunctionReference<"mutation">(
      "followups:upsertApplication"
    ),
    transitionApplicationStatus: makeFunctionReference<"mutation">(
      "followups:transitionApplicationStatus"
    ),
    scheduleFollowUp: makeFunctionReference<"mutation">(
      "followups:scheduleFollowUp"
    ),
    rescheduleFollowUp: makeFunctionReference<"mutation">(
      "followups:rescheduleFollowUp"
    ),
    skipFollowUp: makeFunctionReference<"mutation">(
      "followups:skipFollowUp"
    ),
    createOutreachDraft: makeFunctionReference<"mutation">(
      "followups:createOutreachDraft"
    ),
    updateOutreachDraft: makeFunctionReference<"mutation">(
      "followups:updateOutreachDraft"
    ),
    approveOutreachDraft: makeFunctionReference<"mutation">(
      "followups:approveOutreachDraft"
    ),
    markManualSendComplete: makeFunctionReference<"mutation">(
      "followups:markManualSendComplete"
    ),
    recordResponse: makeFunctionReference<"mutation">(
      "followups:recordResponse"
    ),
  },
};
