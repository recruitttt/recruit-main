import dashboardSummary from "@/data/om-demo/dashboard-summary.json";
import jobDetails from "@/data/om-demo/job-details.json";
import manifest from "@/data/om-demo/manifest.json";
import pipelineLogs from "@/data/om-demo/pipeline-logs.json";
import recommendations from "@/data/om-demo/recommendations.json";
import verification from "@/data/om-demo/verification.json";

export const OM_DEMO_USER_ID = "om-demo";

export function shouldUseOmDemoData() {
  return process.env.DASHBOARD_DATA_SOURCE !== "convex";
}

export function omDemoLivePayload() {
  return {
    run: dashboardSummary,
    recommendations,
    logs: pipelineLogs,
    followUps: emptyFollowUps(),
    fixture: {
      source: "data/om-demo",
      manifest,
      verification,
    },
  };
}

export function omDemoJobDetail(jobId: string) {
  return (jobDetails as Array<{ job?: { _id?: string }; recommendation?: { jobId?: string } }>).find(
    (detail) => detail.job?._id === jobId || detail.recommendation?.jobId === jobId
  ) ?? null;
}

export function emptyFollowUps() {
  return {
    applications: [],
    dueTasks: [],
    scheduledTasks: [],
    counts: {
      applications: 0,
      applied: 0,
      due: 0,
      responses: 0,
      interviews: 0,
      rejectedClosed: 0,
    },
  };
}
