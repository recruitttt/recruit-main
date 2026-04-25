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
    upsertDemoProfileSnapshot: makeFunctionReference<"mutation">(
      "ashby:upsertDemoProfileSnapshot"
    ),
    upsertTailoredApplication: makeFunctionReference<"mutation">(
      "ashby:upsertTailoredApplication"
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
};
