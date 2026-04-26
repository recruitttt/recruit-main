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
    startOnboardingPipeline: makeFunctionReference<"mutation">(
      "ashby:startOnboardingPipeline"
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
    seedCuratedAtsSources: makeFunctionReference<"action">(
      "ashbyActions:seedCuratedAtsSources"
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
    runWorkableIngestion: makeFunctionReference<"action">(
      "ashbyActions:runWorkableIngestion"
    ),
    runAtsIngestion: makeFunctionReference<"action">(
      "ashbyActions:runAtsIngestion"
    ),
    runMixedProviderIngestion: makeFunctionReference<"action">(
      "ashbyActions:runMixedProviderIngestion"
    ),
    rankIngestionRun: makeFunctionReference<"action">(
      "ashbyActions:rankIngestionRun"
    ),
  },
  applicationJobs: {
    createApplicationJob: makeFunctionReference<"mutation">(
      "applicationJobs:createApplicationJob"
    ),
    createAndScheduleApplicationJob: makeFunctionReference<"mutation">(
      "applicationJobs:createAndScheduleApplicationJob"
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
  recruiters: {
    listForUser: makeFunctionReference<"query">("recruiters:listForUser"),
    getById: makeFunctionReference<"query">("recruiters:getById"),
    findByJobId: makeFunctionReference<"query">("recruiters:findByJobId"),
    upsertRecruiter: makeFunctionReference<"mutation">(
      "recruiters:upsertRecruiter"
    ),
    setRecruiterStatus: makeFunctionReference<"mutation">(
      "recruiters:setRecruiterStatus"
    ),
    setCompanyContext: makeFunctionReference<"mutation">(
      "recruiters:setCompanyContext"
    ),
    getConversation: makeFunctionReference<"query">(
      "recruiters:getConversation"
    ),
    appendMessage: makeFunctionReference<"mutation">(
      "recruiters:appendMessage"
    ),
    appendBrainstormedAnswer: makeFunctionReference<"mutation">(
      "recruiters:appendBrainstormedAnswer"
    ),
  },
  recruiterActions: {
    sendMessage: makeFunctionReference<"action">(
      "recruiterActions:sendMessage"
    ),
    seedRecruiters: makeFunctionReference<"action">(
      "recruiterActions:seedRecruiters"
    ),
    applyThroughRecruiter: makeFunctionReference<"action">(
      "recruiterActions:applyThroughRecruiter"
    ),
  },
  personalizationAgent: {
    respondToUser: makeFunctionReference<"action">(
      "personalizationAgent:respondToUser"
    ),
  },
};
