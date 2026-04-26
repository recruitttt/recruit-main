#!/usr/bin/env tsx

import { downloadResumeScoreDetails, parseDownloadArgs } from "@/evals/ats-benchmark/src/download";

async function main() {
  const options = parseDownloadArgs(process.argv.slice(2));
  const result = await downloadResumeScoreDetails(options);
  console.log(`Downloaded ${result.fileCount} files from ${result.dataset}`);
  console.log(`Output: ${result.outputDir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
