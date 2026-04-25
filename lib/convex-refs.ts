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
    runAshbyIngestion: makeFunctionReference<"action">(
      "ashbyActions:runAshbyIngestion"
    ),
    rankIngestionRun: makeFunctionReference<"action">(
      "ashbyActions:rankIngestionRun"
    ),
  },
};
