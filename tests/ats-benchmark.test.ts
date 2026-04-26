import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { normalizeDataset, normalizeRecord } from "../evals/ats-benchmark/src/normalize";
import { hasSensitiveContact } from "../evals/ats-benchmark/src/redact";
import { ResumeMatcherClient } from "../evals/ats-benchmark/src/resume-matcher";
import { scoreResumeTextWithKeywords } from "../evals/ats-benchmark/src/scoring";
import { runBenchmark } from "../evals/ats-benchmark/src/run";
import { profileFromResumeText, researchFromSample } from "../evals/ats-benchmark/src/recruit-tailor";
import { validateResumeQuality } from "../lib/tailor/tailor";

async function main() {
  const score = scoreResumeTextWithKeywords(
    "Built Python APIs with Postgres and React dashboards.",
    {
      required_skills: ["Python", "Postgres"],
      preferred_skills: ["React"],
      keywords: ["Kubernetes"],
    }
  );
  assert.equal(score.score, 75);
  assert.deepEqual(score.missingKeywords, ["Kubernetes"]);

  const normalized = normalizeRecord(
    {
      input: {
        resume: "Ada Lovelace\nada@example.com\nBuilt TypeScript APIs with Postgres for analytics teams.",
        job_description: "Backend role requiring TypeScript, Postgres, and API design.",
      },
      minimum_requirements: ["TypeScript", "Postgres"],
      score: 0.9,
    },
    { source: "unit", fallbackId: "unit.json" }
  );
  assert.ok(normalized);
  assert.equal(normalized.referenceScore, 90);
  assert.equal(hasSensitiveContact(normalized.resumeText), false);
  assert.ok(normalized.resumeText.includes("[EMAIL]"));

  const structured = normalizeRecord(
    {
      input: {
        resume: "Ada Lovelace\nBuilt TypeScript APIs at Analytical Engines.\nProject: compiler-lab.",
        job_description: "Backend role requiring TypeScript.",
      },
      minimum_requirements: ["TypeScript"],
      details: {
        name: "Ada Lovelace",
        email_id: "ada@example.com",
        skills: ["TypeScript"],
        employment_history: [
          {
            company_name: "Analytical Engines",
            job_title: "Engineer",
            details: "Engineer at Analytical Engines",
          },
        ],
        projects: [{ title: "compiler-lab", description: "TypeScript compiler tooling" }],
      },
      output: {
        personal_info: {
          email: "ada@example.com",
          phone: "415-555-1212",
          current_company: "Analytical Engines",
          current_position: "Engineer",
        },
      },
    },
    { source: "unit", fallbackId: "structured.json" }
  );
  assert.ok(structured);
  assert.equal(structured.metadata?.structuredProfile?.hasStructuredProfile, true);
  assert.deepEqual(structured.metadata?.structuredProfile?.employers, ["Analytical Engines"]);
  assert.deepEqual(structured.metadata?.structuredProfile?.projects, ["compiler-lab"]);
  assert.equal(hasSensitiveContact(JSON.stringify(structured.metadata)), false);

  const profile = profileFromResumeText(structured);
  assert.equal(profile.experience[0]?.company, "Analytical Engines");
  assert.equal(profile.github?.topRepos[0]?.name, "compiler-lab");
  const research = researchFromSample(structured, { required_skills: ["TypeScript"] });
  const quality = validateResumeQuality(
    {
      name: "Ada Lovelace",
      email: "candidate@example.test",
      links: {},
      headline: "Engineer",
      summary: "Builds TypeScript APIs.",
      skills: ["TypeScript"],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          bullets: ["Built TypeScript APIs for compiler tooling."],
        },
      ],
      education: [],
      projects: [
        {
          name: "compiler-lab",
          technologies: ["TypeScript"],
          bullets: ["Built TypeScript compiler tooling."],
        },
      ],
      tailoringNotes: { matchedKeywords: [], emphasizedExperience: [], gaps: [], confidence: 80 },
    },
    profile,
    research
  );
  assert.equal(quality.hardOk, true);

  const jdLike = normalizeRecord(
    {
      input: {
        resume: "Team Lead\nExperience Required: 10 years\nKey Responsibilities: Lead the team\nEligibility: Bachelor's degree",
        job_description: "Engineering manager role.",
      },
    },
    { source: "unit", fallbackId: "jd-like.json" }
  );
  assert.ok(jdLike);
  assert.equal(jdLike.valid, false);
  assert.equal(jdLike.metadata?.dataQuality?.resumeLooksLikeJobDescription, true);

  const tmp = await mkdtemp(path.join(os.tmpdir(), "ats-benchmark-"));
  try {
    const rawDir = path.join(tmp, "raw");
    const normalizedPath = path.join(tmp, "normalized", "samples.jsonl");
    await mkdir(rawDir, { recursive: true });
    await writeFile(
      path.join(rawDir, "sample.json"),
      `${JSON.stringify({
        id: "valid_1",
        input: {
          resume: "Grace Hopper\n415-555-1212\nFrontend engineer with React TypeScript accessibility systems and Kubernetes references.",
          job_description: "Frontend role requiring React, TypeScript, accessibility, and design systems. Kubernetes Kubernetes Kubernetes.",
        },
        minimum_requirements: ["React", "TypeScript", "accessibility"],
        details: {
          name: "Grace Hopper",
          skills: ["React", "TypeScript", "accessibility"],
          employment_history: [{ company_name: "Navy Systems", job_title: "Frontend Engineer" }],
        },
        total_score: 83,
      })}\n${JSON.stringify({
        id: "invalid_1",
        input: {
          resume: "Job Title: Frontend Engineer\nExperience Required: 5 years\nKey Responsibilities: Build UI\nQualifications: React",
          job_description: "Frontend role requiring React.",
        },
      })}`,
      "utf8"
    );
    const normalizeResult = await normalizeDataset({ inputDir: rawDir, outputPath: normalizedPath });
    assert.equal(normalizeResult.samples.length, 2);
    const normalizedText = await readFile(normalizedPath, "utf8");
    assert.equal(hasSensitiveContact(normalizedText), false);

    const fetchCalls: string[] = [];
    const client = new ResumeMatcherClient({
      baseUrl: "http://resume-matcher.test",
      fetchFn: async (url, init) => {
        fetchCalls.push(`${init?.method ?? "GET"} ${url}`);
        const textUrl = String(url);
        if (textUrl.endsWith("/api/v1/health")) {
          return json({ status: "healthy" });
        }
        if (textUrl.endsWith("/api/v1/resumes/upload")) {
          return json({ resume_id: "resume_1" });
        }
        if (textUrl.endsWith("/api/v1/jobs/upload")) {
          return json({ job_id: ["job_1"] });
        }
        if (textUrl.endsWith("/api/v1/resumes/improve/preview")) {
          return json({
            data: {
              markdownImproved: "React TypeScript accessibility",
              refinement_stats: { final_match_percentage: 100 },
            },
          });
        }
        if (textUrl.endsWith("/api/v1/jobs/job_1")) {
          return json({ job_keywords: { required_skills: ["React", "TypeScript"], keywords: ["accessibility"] } });
        }
        return json({ detail: "not found" }, 404);
      },
    });
    assert.equal(await client.health(), true);
    const first = await client.analyze({
      sampleId: "sample",
      resumeText: "React TypeScript",
      jobDescription: "React TypeScript accessibility",
    });
    const second = await client.analyze({
      sampleId: "sample",
      resumeText: "React TypeScript",
      jobDescription: "React TypeScript accessibility",
    });
    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.equal(fetchCalls.filter((call) => call.includes("/improve/preview")).length, 1);

    const run = await runBenchmark({
      profile: "smoke",
      inputPath: normalizedPath,
      outputRoot: path.join(tmp, "runs"),
      tailor: "none",
      useSidecar: false,
      now: new Date("2026-04-25T00:00:00.000Z"),
    });
    assert.equal(run.summary.sampleCount, 2);
    assert.equal(run.summary.validSampleCount, 1);
    assert.equal(run.summary.skippedCount, 1);
    assert.equal(run.summary.invalidResumeLikeJob, 1);
    assert.equal(run.summary.tailoredCount, 0);
    assert.equal(run.results.find((item) => item.sampleId === "valid_1")?.baselineScore, 100);
    assert.ok(await readFile(path.join(run.runDir, "summary.json"), "utf8"));
    assert.ok(await readFile(path.join(run.runDir, "samples.csv"), "utf8"));
    assert.ok(await readFile(path.join(run.runDir, "rankings.csv"), "utf8"));
    assert.ok(await readFile(path.join(run.runDir, "report.md"), "utf8"));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  console.log("ATS benchmark tests passed");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
