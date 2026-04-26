# Recruit Production E2E Test Prompt

Use this prompt to run a detailed production or staging smoke test of the Recruit pipeline.

```text
You are testing Recruit end to end in a production-like environment. Your job is to verify the whole supervised job-application pipeline, gather concrete evidence, and stop before any irreversible external action unless an explicit test-only submit gate is configured.

Product under test:
- Recruit is an autonomous job-application agent.
- Core flow: onboarding profile -> resume/profile extraction -> job ingestion -> filtering -> ranking -> company/job research -> tailored resume + PDF -> ATS form fill/stage -> DLQ/human answer handling -> follow-up tracking.
- Primary production provider path is Ashby. Other ATS providers may exist but should be reported separately as preview unless verified.

Environment:
- Base URL: <PROD_OR_STAGING_URL>
- Test account: <TEST_ACCOUNT_EMAIL>
- Auth method: <PASSWORD_OR_MAGIC_LINK_OR_SSO_DETAILS>
- Convex deployment/dashboard: <CONVEX_DEPLOYMENT_OR_DASHBOARD_LINK>
- Allowed test ATS/company sources: <ALLOWED_TEST_SOURCES>
- Hard safety rule: do not submit a real job application unless this environment has a dedicated test posting or a confirmed no-op submit gate.

Non-secret Recruit E2E config:
- Default base URL: https://recruit-main.vercel.app. Override with `E2E_BASE_URL` or `--base-url=<url>`.
- Local env file: the runner loads `.env.e2e.local` by default before reading env vars. Override with `--env-file=<path>`.
- Test account email identifier: `E2E_AUTH_EMAIL`. Store the password only in `E2E_AUTH_PASSWORD` or the team's secret manager.
- Auth method: Better Auth email/password through `/sign-in`.
- Convex deployment/dashboard: use the deployment linked by `NEXT_PUBLIC_CONVEX_URL`; keep dashboard tokens and admin links out of repo text.
- Allowed ATS/company sources for smoke: Ashby only, bounded to `limitSources:3` unless a run explicitly opts into preview providers.
- Pipeline launch: the full smoke uses `/api/onboarding/launch-pipeline` with the fixed E2E test profile. `/api/dashboard/run-ingestion` is fallback-only via `--dashboard-ingestion-fallback`.
- ATS submit policy: `dry_run` by default. A real submit requires `RECRUIT_ASHBY_SUBMIT_GATE=1` plus `RECRUIT_ASHBY_TEST_POSTING_URL` or `RECRUIT_ASHBY_ALLOWED_SUBMIT_URLS` matching a dedicated test posting.
- Test fixtures: set `RECRUIT_E2E_FIXTURES=1` in the target environment only when DLQ/follow-up fixture mutations should be enabled.
- Protected Vercel previews: set `VERCEL_AUTOMATION_BYPASS_SECRET` in the local E2E env file or CI secret store so the runner can send Vercel's automation bypass header. Do not commit or paste the bypass secret.
- Runner command examples:
  - Contract-only: `npm run e2e:prod-smoke -- --env-file=.env.e2e.local --contracts-only --base-url=<staging-url>`
  - Staging full smoke: `npm run e2e:prod-smoke -- --env-file=.env.e2e.local --base-url=<staging-url> --with-auth-ui --with-fixtures --with-ats-staging --limit-sources=3 --tailor-limit=1`
  - Production dry-run: `npm run e2e:prod-smoke -- --env-file=.env.e2e.local --base-url=https://recruit-main.vercel.app --with-auth-ui --with-ats-staging --limit-sources=3 --tailor-limit=1`
  - Fallback ingestion: `npm run e2e:prod-smoke -- --env-file=.env.e2e.local --base-url=<staging-url> --dashboard-ingestion-fallback`

Required secrets/configuration checks:
- Next runtime has NEXT_PUBLIC_CONVEX_URL configured.
- Convex actions can access OPENAI_API_KEY.
- Next route handlers can access OPENAI_API_KEY.
- Browser/PDF runtime has either LOCAL_CHROME_PATH or cloud browser config if needed.
- Optional fallback keys are documented if used: FIRECRAWL_API_KEY, PROXYCURL_API_KEY, BROWSERBASE_*.
- Stripe is not part of the core application pipeline; verify only if this run explicitly includes pricing/checkout.

Test data:
- Use a dedicated test user/profile, not a real candidate applying to real jobs.
- Candidate name: Recruit E2E Test Candidate
- Email: <TEST_ACCOUNT_EMAIL>
- Location: San Francisco, CA / Remote
- Target roles: Software Engineer, Product Engineer
- Target locations: Remote, San Francisco
- Skills: TypeScript, React, Next.js, Node.js, PostgreSQL, AWS, Docker, API design, AI tooling
- Experience:
  - Nimbus Labs, Software Engineer, 2023-present: React, Node.js, cloud infrastructure, applied AI automation, internal data pipelines.
  - Atlas Systems, Frontend Engineer, 2021-2023: TypeScript interfaces, API integrations, performance work, design system components.
- Education: State University, BS Computer Science, 2021
- Public links may be fake/safe test links unless profile scraping is explicitly in scope.

Runbook:

1. Preflight and baseline
   - Open the app at <PROD_OR_STAGING_URL>.
   - Sign in as the dedicated test account.
   - Confirm the dashboard loads without client errors.
   - Capture the build/version/commit if visible. If not visible, note that version evidence is unavailable.
   - Record current pipeline state before starting: latest run id, status, recommendation count, tailored count, DLQ count, follow-up count.

2. Onboarding/profile intake
   - Navigate to /onboarding.
   - Complete the onboarding flow with the test profile above.
   - If resume upload is supported in this environment, upload the approved test resume. If not, enter equivalent structured profile data manually.
   - Verify profile fields survive navigation/reload and appear in /settings or the dashboard profile surface.
   - Expected pass: profile snapshot is saved and the pipeline launch action returns ok=true with a runId, or the UI clearly reports that the pipeline started.

3. Pipeline launch and ingestion
   - Trigger the onboarding launch or dashboard ingestion action.
   - Prefer a bounded run: Ashby provider, limitSources=3, tailorLimit=3 if controls exist.
   - Verify the run transitions through fetching/storage/filtering/ranking rather than staying queued.
   - Expected pass:
     - ingestion run status reaches completed or a documented non-terminal async state with active logs;
     - fetchedCount > 0;
     - rawJobCount > 0;
     - errorCount is 0, or every source error is captured and non-fatal;
     - ingested jobs have jobUrl and non-empty descriptionPlain or equivalent JD text.

4. Filtering and ranking
   - Verify hard filters are applied and persisted.
   - Verify ranking produces recommendations.
   - Expected pass:
     - survivorCount > 0;
     - recommendedCount > 0;
     - scoringMode is "llm" when OPENAI_API_KEY is available to Convex;
     - each top recommendation has company, title, jobUrl, rank, score, strengths/risks or rationale.
   - Failure to flag: scoringMode="heuristic_fallback" in a production E2E run unless the run was intentionally configured without OpenAI.

5. Job detail and research
   - Open the top recommendation detail.
   - Confirm job detail loads from persisted state.
   - Trigger or verify research for the selected job.
   - Expected pass:
     - research source is one of ingested-description, deep-research, firecrawl-fallback, or title-only;
     - research includes jdSummary, responsibilities, requirements, techStack, and company signals where available;
     - thin title-only research is acceptable only as a fallback and should be reported.

6. Tailoring and PDF
   - Trigger tailoring for the top recommendation, then for up to the top 3 if the UI supports batch tailoring.
   - Wait for tailoring to complete or fail with a specific reason.
   - Expected pass:
     - tailoredApplications record status is completed;
     - tailored resume includes only facts supported by the source profile;
     - tailoringScore and keywordCoverage are present;
     - quality issues and gaps are explicit;
     - pdfReady=true;
     - pdfFilename is present;
     - pdf byte length is > 0;
     - downloaded/viewed PDF opens and contains the candidate name plus role-relevant keywords.
   - Failure to flag:
     - fabricated employer, degree, authorization status, skill, or project;
     - tailor_quality_failed;
     - no_api_key from /api/tailor/job or /api/dashboard/tailor-job;
     - generated PDF is empty/corrupt.

7. ATS form fill / application staging
   - Use only a permitted test posting or a no-op/staged form path.
   - Open the application automation for a selected Ashby job.
   - Verify the agent discovers form fields, maps questions, uploads/attaches the tailored resume where supported, and stages answers.
   - Expected pass:
     - form discovery identifies required fields;
     - safe profile fields are filled;
     - unknown/sensitive fields are not guessed;
     - evidence includes mapped fields, skipped fields, upload state, and final staged status;
     - no real final submit occurs unless explicitly allowed.
   - Failure to flag:
     - agent guesses work authorization, sponsorship, demographic, disability, veteran, legal, salary, or custom free-text truth;
     - submit button is clicked on a real posting without explicit approval;
     - form state after upload is not verified.

8. DLQ and answer cache
   - Force or identify at least one unanswerable/sensitive question.
   - Confirm it appears in /dlq.
   - Approve a safe reusable answer for a test-only field.
   - Re-run or resume form mapping.
   - Expected pass:
     - DLQ item has question text, provider/job context, reason, and proposed handling;
     - approved answer is cached;
     - cached answer is reused only for matching/safe fields;
     - audit trail shows human approval.

9. Follow-up tracking
   - Mark a staged or test application as applied if allowed by the test scenario.
   - Verify /dashboard/followups or the dashboard follow-up surface updates.
   - Expected pass:
     - application appears in follow-up summary;
     - counts update;
     - due/scheduled tasks are shown with company/title context.

10. API contract spot checks
   - From the production-like environment, verify these route behaviors without printing secrets:
     - POST /api/research/job with malformed JSON returns 400 bad_request.
     - POST /api/research/job with missing jobUrl returns 400 missing_job_url.
     - POST /api/tailor/job with missing profile/research/job returns 400 missing_profile_or_research_or_job.
     - POST /api/dashboard/run-ingestion with invalid provider returns 400 invalid_provider.
     - GET /api/dashboard/job-detail without jobId returns 400 missing_job_id.
   - Expected pass: failures are explicit JSON errors, not 500s or HTML error pages.

11. Observability and evidence collection
   - Collect screenshots for onboarding complete, pipeline dashboard, top recommendation, research snapshot, tailored resume/PDF, ATS staging, DLQ, and follow-ups.
   - Collect runId, top jobId, response snippets, persisted counts, and key log messages.
   - Do not collect or paste raw secrets, tokens, auth cookies, private keys, or real candidate PII.

Acceptance criteria:
- Profile is saved for the test user.
- Pipeline run starts and produces a runId.
- Ingestion fetches at least one source and stores jobs.
- Filtering and ranking produce at least one recommendation.
- LLM ranking is used when configured.
- Research snapshot exists for at least one recommendation.
- Tailoring completes for at least one recommendation.
- PDF is generated and opens correctly.
- ATS automation stages or no-op-fills an application without unsafe guessing.
- DLQ captures at least one human-required answer path.
- Follow-up state updates after a staged/applied test application.
- Every failure has a specific stage, endpoint/action, error body, timestamp, and runId/jobId where applicable.

Report format:

## Executive Summary
- Overall result: PASS / PARTIAL / FAIL
- Environment:
- Test account:
- Run ID:
- Top job tested:
- Main blockers:

## Stage Results
| Stage | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Auth/dashboard |  |  |  |
| Onboarding/profile |  |  |  |
| Ingestion |  |  |  |
| Filtering/ranking |  |  |  |
| Research |  |  |  |
| Tailoring/PDF |  |  |  |
| ATS staging |  |  |  |
| DLQ/cache |  |  |  |
| Follow-ups |  |  |  |
| API contracts |  |  |  |

## Metrics
- sourceCount:
- fetchedCount:
- rawJobCount:
- filteredCount:
- survivorCount:
- llmScoredCount:
- recommendedCount:
- tailoredCompletedCount:
- pdfByteLength:
- dlqCreatedCount:
- followupCount:

## Evidence
- Screenshots:
- Logs:
- API responses:
- Convex records/counts:

## Bugs / Risks
For each issue include:
- Severity:
- Stage:
- Repro steps:
- Expected:
- Actual:
- Evidence:
- Suspected cause:
- Suggested fix:

## Safety Review
- Was any real application submitted? Yes/No
- Were sensitive fields guessed? Yes/No
- Were secrets exposed in logs or screenshots? Yes/No
- Were DLQ decisions auditable? Yes/No
```
