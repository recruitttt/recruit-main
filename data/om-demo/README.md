# OM Demo Data Snapshot

This directory is a dashboard-development snapshot exported from production
Convex for `demoUserId: "om-demo"`.

- `manifest.json`: export metadata and privacy notes.
- `dashboard-summary.json`: run summary and recommendation rollup.
- `recommendations.json`: ranked recommendation cards with public job data.
- `job-details.json`: job descriptions, ranking decisions/scores, research, and
  tailored resume metadata.
- `pipeline-logs.json`: pipeline events for ingestion, ranking, and tailoring.
- `verification.json`: count checks for the seeded run.

The snapshot intentionally excludes OM profile raw text and PDF base64. Convex
remains the canonical source for production; this directory is for offline UI
development and tests.
