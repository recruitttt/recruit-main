# ATS Benchmark

Offline benchmark harness for scoring raw and Recruit-tailored resumes against an open-source ATS-style scoring engine.

V1 standardizes on Resume Matcher compatibility:

- Sidecar image: `ghcr.io/srbhr/resume-matcher:1.2.0`
- Health: `GET /api/v1/health`
- Primary scoring: Resume Matcher keyword model with whole-word matching

Raw datasets and generated runs are intentionally ignored by git.

## Commands

```bash
npm run ats:download
npm run ats:normalize
npm run ats:benchmark -- --profile=smoke --scorer=resume-matcher --no-tailor
npm run ats:benchmark -- --profile=smoke --scorer=resume-matcher --tailor=recruit
```

Use `--sidecar` to call a running Resume Matcher API at `RESUME_MATCHER_URL` or `--resume-matcher-url=http://localhost:3000`.
