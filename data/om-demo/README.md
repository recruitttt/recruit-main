# OM Demo Data Snapshot

This directory is a dashboard-development snapshot exported from production
Convex for `demoUserId: "om-demo"`.

- `manifest.json`: export metadata and privacy notes.
- `dashboard-summary.json`: run summary and recommendation rollup.
- `recommendations.json`: ranked recommendation cards with public job data.
- `job-details.json`: job descriptions, ranking decisions/scores, research, and
  tailored resume metadata.
- `pipeline-logs.json`: pipeline events for ingestion, ranking, and tailoring.
- `organizations.json`: demo-only prestigious company overlays, including
  stored logo URLs and brand metadata used by the dashboard.
- `verification.json`: count checks for the seeded run.

The snapshot intentionally excludes OM profile raw text and PDF base64. Recruit
Main treats this directory as the canonical sample-job source in local
development, deployed previews, and Convex-configured dashboard builds. Live
Convex dashboard reads are operator-only and require both
`DASHBOARD_DATA_SOURCE=convex` and `DASHBOARD_LIVE_CONVEX_ENABLED=true`.
