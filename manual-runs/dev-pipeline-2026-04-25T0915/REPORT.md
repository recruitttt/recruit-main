# Dev Branch Manual Pipeline Run Report

Date: 2026-04-25
Workspace: `/Users/owenfisher/Desktop/recruit-main-applied-detail`
Branch: `dev`
Commit tested: `f381de8cde2faed1a3e63634e432ce87d54e4348`
Convex run ID: `m97e0tma68bgc8m8s653rvy7j185henn`
Demo user: `demo`

## Summary

The dev branch pipeline now runs through ingestion, filtering, ranking, and tailoring with persisted Convex state.

The first pass exposed two setup gaps:

- Ranking fell back to `heuristic_fallback` because the OpenAI key was not available to Convex.
- Tailoring returned `503 {"ok":false,"reason":"no_api_key"}` because the OpenAI key was not available to the local Next runtime.

After setting `OPENAI_API_KEY` in both Convex dev env and local `.env.local`, ranking reran with `scoringMode: "llm"` and tailoring completed for the top recommendation.

## How The Pipeline Was Triggered

Profile setup:

```bash
npx convex run --push ashby:upsertDemoProfileSnapshot
```

Source seeding:

```bash
npx convex run ashbyActions:seedAshbySourcesFromCareerOps
```

Ingestion:

```bash
npx convex run ashbyActions:runAshbyIngestion '{"limitSources":3}'
```

Initial ranking:

```bash
npx convex run ashbyActions:rankIngestionRun '{"runId":"m97e0tma68bgc8m8s653rvy7j185henn"}'
```

Post-key reranking:

```bash
npx convex run ashbyActions:rankIngestionRun '{"runId":"m97e0tma68bgc8m8s653rvy7j185henn"}'
```

Tailoring:

```bash
POST /api/dashboard/tailor-job
```

Payload:

```json
{
  "jobId": "m57ba85n9qtsc1npz9859ww0kx85gscv"
}
```

## Inputs Used

Resume/profile:

- Built-in `DEMO_PROFILE`
- Candidate: `Demo Candidate`
- Stored in Convex `demoProfiles`
- Local evidence copy: `manual-runs/dev-pipeline-2026-04-25T0915/input-profile.json`

JD/source input:

- Ashby source seed list from Career Ops
- Ingestion limited to 3 sources
- Sources fetched:
  - Aleph Alpha
  - Attio
  - Bland AI

Raw jobs/JDs fetched:

- 52 jobs total
- Every sampled ingested job had both raw source payload and plain-text JD content.

## Stage Status

| Stage | Status | Evidence |
| --- | --- | --- |
| Profile snapshot | Working | Convex `demoProfiles`; `upsertDemoProfileSnapshot` returned `demoUserId: demo` |
| Ingestion | Working | Convex `ingestionRuns`, `ingestedJobs`, `jobPipelineArtifacts` |
| Filtering | Working | Convex `jobFilterDecisions` |
| Ranking | Working after key setup | Convex `jobScores`, `jobRecommendations`; rerun used `scoringMode: llm` |
| Tailoring | Working after key setup | Convex `tailoredApplications`, `jobPipelineArtifacts` |
| PDF generation | Partial persistence | PDF metadata persisted; actual PDF bytes returned by route but not stored in Convex/S3 |

## Final Persisted State

Convex `ingestionRuns`:

```json
{
  "_id": "m97e0tma68bgc8m8s653rvy7j185henn",
  "status": "completed",
  "sourceCount": 3,
  "fetchedCount": 3,
  "rawJobCount": 52,
  "filteredCount": 24,
  "survivorCount": 28,
  "llmScoredCount": 28,
  "recommendedCount": 11,
  "errorCount": 0,
  "model": "gpt-4o-mini",
  "scoringMode": "llm",
  "startedAt": "2026-04-25T16:12:58.166Z",
  "completedAt": "2026-04-25T16:26:43.099Z"
}
```

Persisted record counts:

| Artifact | Count | Storage |
| --- | ---: | --- |
| Ingested jobs | 52 | Convex `ingestedJobs` |
| Filter decisions | 52 | Convex `jobFilterDecisions` |
| Kept jobs | 28 | Convex `jobFilterDecisions` |
| Rejected jobs | 24 | Convex `jobFilterDecisions` |
| Ranking scores | 28 | Convex `jobScores` |
| Recommendations | 11 | Convex `jobRecommendations` |
| Tailored applications | 1 | Convex `tailoredApplications` |
| Pipeline logs | 22 | Convex `pipelineLogs` |
| Pipeline artifacts | 111 | Convex `jobPipelineArtifacts` |

Artifact kinds:

| Kind | Count | Storage |
| --- | ---: | --- |
| `ingested_description` | 52 | Convex `jobPipelineArtifacts` |
| `ranking_score` | 56 | Convex `jobPipelineArtifacts` |
| `research_snapshot` | 1 | Convex `jobPipelineArtifacts` |
| `tailored_resume` | 1 | Convex `jobPipelineArtifacts` |
| `pdf_ready` | 1 | Convex `jobPipelineArtifacts` |

Note: `ranking_score` count is 56 because the run was ranked twice: once before key setup with heuristic scoring, and once after key setup with LLM scoring. The final `jobScores` table has 28 current score records because ranking results are rewritten per run; artifact records are append-only.

## Ranking Result

Post-key reranking:

```json
{
  "filteredCount": 24,
  "llmScoredCount": 28,
  "recommendedCount": 11,
  "runId": "m97e0tma68bgc8m8s653rvy7j185henn",
  "scoringMode": "llm",
  "survivorCount": 28
}
```

Top recommendation after LLM reranking:

```json
{
  "rank": 1,
  "company": "Attio",
  "title": "Senior Product Engineer [Backend]",
  "score": 90,
  "llmScore": 90,
  "jobId": "m57ba85n9qtsc1npz9859ww0kx85gscv"
}
```

## Tailoring Result

Tailoring target:

- Company: Attio
- Role: Senior Product Engineer [Backend]
- Job ID: `m57ba85n9qtsc1npz9859ww0kx85gscv`
- Job URL: `https://jobs.ashbyhq.com/attio/0c324962-7ae8-4f1b-9eb4-2047babc4bd8`

Route result:

```json
{
  "ok": true,
  "profileSource": "demo",
  "jobId": "m57ba85n9qtsc1npz9859ww0kx85gscv",
  "company": "Attio",
  "role": "Senior Product Engineer [Backend]",
  "tailoringScore": 54,
  "keywordCoverage": 30,
  "durationMs": 32308,
  "pdfBase64Length": 173048
}
```

Persisted tailored application:

```json
{
  "status": "completed",
  "pdfReady": true,
  "pdfFilename": "Resume_Attio.pdf",
  "pdfByteLength": 129786,
  "tailoringScore": 54,
  "keywordCoverage": 30
}
```

Persisted tailoring artifacts:

- `research_snapshot`
- `tailored_resume`
- `pdf_ready`

## Logs Proving It Ran

Important persisted Convex log messages:

- `Started Ashby ingestion for 3 sources.`
- `Fetched 10 jobs from Aleph Alpha.`
- `Fetched 13 jobs from Bland AI.`
- `Fetched 29 jobs from Attio.`
- `Stored 52 scraped jobs with 0 source errors.`
- `Started ranking ingested jobs.`
- `Loaded 52 ingested jobs for ranking.`
- `Applied hard filters: 28 kept, 24 rejected.`
- `BM25 ranked 28 candidates.`
- `Scored 28 candidates using llm.`
- `Wrote 11 recommendations.`
- `Started tailoring Attio - Senior Product Engineer [Backend]`
- `Tailored resume ready for Attio - Senior Product Engineer [Backend]`

Local audit evidence folder:

```text
manual-runs/dev-pipeline-2026-04-25T0915/
```

Key local files:

- `pipeline-summary.json`
- `rerank-after-openai-key.json`
- `persisted-state.json`
- `top-recommendations-after-openai-key.json`
- `13-tailor-after-openai-key.response.json`
- `13-next-dev-after-openai-key.log`

## Gaps And Risks

Raw resumes:

- The pipeline persisted the structured demo profile, not the raw resume file.
- For a real uploaded resume, raw file persistence still needs a durable storage target and record linkage.

PDF persistence:

- Tailoring returned PDF bytes as `pdfBase64` and persisted PDF metadata in Convex.
- The actual PDF bytes are not persisted in Convex, S3, or object storage.
- Current durable state proves a PDF was generated (`pdf_ready`, filename, byte length), but it does not preserve the file itself for later download.

Artifact duplication:

- `jobPipelineArtifacts(kind="ranking_score")` is append-only.
- Reranking the same run created another set of ranking artifacts, so artifacts contain both the pre-key heuristic pass and post-key LLM pass.
- Current `jobScores` records are cleanly rewritten, but artifact history is cumulative.

Failure logging:

- The first tailoring failure (`no_api_key`) was captured in local audit files.
- Because the route checks for `OPENAI_API_KEY` before creating a tailored application record, that failure was not persisted to Convex `tailoredApplications` or `pipelineLogs`.

Branch state:

- The local `dev` worktree is diverged from `origin/dev`.
- This report documents the local dev commit tested: `f381de8cde2faed1a3e63634e432ce87d54e4348`.

## Verdict

The pipeline is now runnable end-to-end after OpenAI key setup. Ingestion, filtering, ranking, research, tailoring, and PDF generation all executed, and the main structured outputs are persisted in Convex.

The remaining persistence gaps are raw resume file storage, actual PDF byte storage, and durable logging for early route failures before a pipeline record exists.
