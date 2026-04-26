# ATS Benchmark Comparison Flow

## Purpose

This harness compares raw benchmark resumes against Recruit-tailored resumes using
an ATS-style keyword scorer. The primary claim it is meant to test is whether
Recruit improves resume scores and rankings for the same job descriptions without
introducing unsupported resume content.

## Flow

1. Download data.
   - `npm run ats:download`
   - Pulls `zeel180503/resume-score-details` from Hugging Face into
     `evals/ats-benchmark/.data/raw/resume-score-details/`.

2. Normalize data.
   - `npm run ats:normalize`
   - Reads raw JSON/JSONL files, extracts resume text, job description,
     minimum requirements, reference score/label, validity, and inferred role
     family.
   - Redacts emails and phone numbers before writing
     `evals/ats-benchmark/.data/normalized/resume-score-details.jsonl`.
   - If the normalized file is missing during a benchmark run, the harness falls
     back to `evals/ats-benchmark/fixtures/resume-score-details.jsonl`.

3. Baseline scoring.
   - `npm run ats:benchmark -- --profile=smoke --scorer=resume-matcher --no-tailor`
   - Loads valid normalized samples for the selected profile:
     `smoke=50`, `standard=200`, `full=1000`.
   - Extracts job keywords from `minimumRequirements` plus fallback job
     description keywords.
   - Scores the raw resume with whole-word keyword matching. With `--sidecar`,
     the Resume Matcher API at `RESUME_MATCHER_URL` can supply job keywords and
     its own score; otherwise the local keyword scorer is used.

4. Recruit tailoring.
   - `npm run ats:benchmark -- --profile=smoke --scorer=resume-matcher --tailor=recruit`
   - Converts each benchmark resume into a synthetic `UserProfile`, converts the
     job description into `JobResearch`, then calls Recruit's `tailorResume`.
   - Requires `OPENAI_API_KEY`.
   - Runs Recruit's `validateResumeQuality` before accepting the tailored
     resume. Samples that fail quality validation are marked `failed` and are not
     included in post-tailor averages.

5. Post-tailor scoring.
   - Accepted tailored resumes are flattened back to text and scored against the
     same keyword set as the baseline.
   - The harness records `recruitScore`, `scoreDelta`, matched keyword counts
     before/after, quality issues, and status.
   - Ranking rows are built by using up to five role-family anchor jobs and
     comparing baseline rank versus Recruit rank for each scored sample.

## Outputs

Each run writes to
`evals/ats-benchmark/runs/ats-benchmark-<timestamp>/`:

- `summary.json`: aggregate counts, score averages/medians, rank deltas,
  top-10/top-25 entrants, failure counts, quality penalty rate, and cache hits.
- `samples.csv`: per-sample baseline score, Recruit score, score delta,
  matched keyword counts, reference data, quality issue count, and errors.
- `rankings.csv`: per-anchor baseline/recruit ranks and rank delta.
- `report.md`: short human-readable summary of the run.

## Current Caveat

The fixed smoke run
`evals/ats-benchmark/runs/ats-benchmark-2026-04-26T05-53-07-935Z/` selected 50
valid samples and skipped 5 resume-like-job rows. Recruit tailored 40/50 valid
samples, with average score delta +16.33 and median score delta +10.

The run still has 10 hard validation failures. Most remaining failures are from
rows without structured profile metadata or from skills the LLM added that are
not clearly supported by the normalized benchmark profile. Treat this as a
usable smoke result, but do not treat the 200-sample run as final until the
remaining failure categories are reviewed.

## Recommended Next Steps Before 200-Sample Runs

- Review the remaining hard failures from the latest smoke run and decide
  whether each is a true unsupported addition or a missing parser case.
- Add small regression fixtures for each fixed parser case.
- Run a smoke baseline with `--sidecar` against a healthy Resume Matcher service
  to confirm sidecar keyword extraction and cache behavior.
- Only then run `--profile=standard` for the 200-sample comparison, keeping raw
  and tailored runs separate and preserving the generated run directories.
