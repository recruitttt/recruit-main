#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { parseBenchmarkArgs, runBenchmark } from "@/evals/ats-benchmark/src/run";

async function main() {
  await loadDotEnvLocal();
  const options = parseBenchmarkArgs(process.argv.slice(2));
  const result = await runBenchmark(options);
  console.log("ATS benchmark run");
  console.log(`Samples: ${result.summary.sampleCount}`);
  console.log(`Tailored: ${result.summary.tailoredCount}`);
  console.log(`Average baseline score: ${result.summary.averageBaselineScore}`);
  console.log(`Average Recruit score: ${result.summary.averageRecruitScore}`);
  console.log(`Average score delta: ${result.summary.averageScoreDelta}`);
  console.log(`Run dir: ${result.runDir}`);

  if (!result.summary.ok) {
    process.exitCode = 1;
  }
}

async function loadDotEnvLocal() {
  let raw = "";
  try {
    raw = await readFile(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
