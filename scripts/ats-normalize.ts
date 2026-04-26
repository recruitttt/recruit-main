#!/usr/bin/env tsx

import path from "node:path";
import { normalizeDataset } from "@/evals/ats-benchmark/src/normalize";

type Options = {
  inputDir: string;
  outputPath: string;
  source: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await normalizeDataset(options);
  console.log(`Normalized ${result.samples.length} samples`);
  console.log(`Output: ${result.outputPath}`);
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    inputDir: path.join("evals", "ats-benchmark", ".data", "raw", "resume-score-details"),
    outputPath: path.join("evals", "ats-benchmark", ".data", "normalized", "resume-score-details.jsonl"),
    source: "resume-score-details",
  };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [name, value] = splitArg(arg);
    if (name === "input") options.inputDir = value;
    else if (name === "output") options.outputPath = value;
    else if (name === "source") options.source = value;
    else throw new Error(`Unknown option --${name}`);
  }
  return options;
}

function splitArg(arg: string): [string, string] {
  const body = arg.slice(2);
  const eq = body.indexOf("=");
  return eq === -1 ? [body, "true"] : [body.slice(0, eq), body.slice(eq + 1)];
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
