#!/usr/bin/env npx tsx
// Quick smoke test: create one application job via Convex mutation, wait
// for the action to run, check for screenshots. Run with:
//   npx tsx scripts/test-apply-flow.ts

import { ConvexHttpClient } from "convex/browser";
import { convexRefs } from "../lib/convex-refs";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set. Run: source .env.local");
  process.exit(1);
}

const TEST_URL = "https://recruit-company-pages.vercel.app/google-deepmind";
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log(`Convex URL: ${CONVEX_URL}`);
  console.log(`Target URL: ${TEST_URL}`);
  console.log();

  // Step 1: Create and schedule the job
  console.log("1. Creating application job...");
  let result: { jobId: string; scheduled: boolean; status: string };
  try {
    result = await client.mutation(
      convexRefs.applicationJobs.createAndScheduleApplicationJob,
      {
        targetUrl: TEST_URL,
        providerHint: "generic",
        company: "Google DeepMind",
        title: "Software Engineer (test)",
        submitPolicy: "dry_run",
        engine: "ai-fill",
        llmMode: "best_effort",
        repairLimit: 1,
      }
    ) as { jobId: string; scheduled: boolean; status: string };
    console.log(`   jobId=${result.jobId} scheduled=${result.scheduled} status=${result.status}`);
  } catch (err) {
    console.error("   FAILED to create job:", (err as Error).message);
    process.exit(1);
  }

  // Step 2: Wait and poll for status changes
  console.log("\n2. Polling job status (30s max)...");
  const deadline = Date.now() + 30_000;
  let lastStatus = result.status;
  let screenshotFound = false;

  while (Date.now() < deadline) {
    await sleep(2000);
    try {
      const job = await client.query(
        convexRefs.applicationJobs.getApplicationJob,
        { jobId: result.jobId as never }
      ) as { status: string; error?: string; lastCheckpoint?: string } | null;

      if (!job) {
        console.log("   job not found?!");
        continue;
      }

      if (job.status !== lastStatus) {
        console.log(`   status: ${lastStatus} → ${job.status} (checkpoint=${job.lastCheckpoint ?? "?"})`);
        lastStatus = job.status;
      }

      // Check for screenshots
      const screenshot = await client.query(
        api.applicationJobs.getLatestScreenshot,
        { jobId: result.jobId as never }
      );
      if (screenshot?.pngBase64) {
        const kb = Math.round(screenshot.pngBase64.length * 0.75 / 1024);
        console.log(`   ✅ SCREENSHOT FOUND: label=${screenshot.label} size=${kb}KB`);
        screenshotFound = true;
      }

      if (isTerminal(job.status)) {
        console.log(`\n3. Final status: ${job.status}${job.error ? ` error=${job.error}` : ""}`);
        break;
      }
    } catch (err) {
      console.log(`   poll error: ${(err as Error).message}`);
    }
  }

  // Step 3: Check evidence
  console.log("\n4. Checking evidence records...");
  try {
    const evidence = await client.query(
      api.applicationJobs.listJobEvidence,
      { jobId: result.jobId as never }
    ) as Array<{ kind: string; createdAt: string }>;
    for (const e of evidence) {
      console.log(`   ${e.kind} (${e.createdAt})`);
    }
    if (evidence.length === 0) {
      console.log("   ⚠️  NO evidence records — the action may not have run at all");
    }
  } catch (err) {
    console.log(`   evidence query failed: ${(err as Error).message}`);
  }

  console.log(`\nScreenshot: ${screenshotFound ? "✅ YES" : "❌ NO"}`);
  console.log(`Final status: ${lastStatus}`);
}

function isTerminal(status: string): boolean {
  return [
    "filled_verified",
    "submitted_confirmed",
    "submitted_probable",
    "duplicate_or_already_applied",
    "needs_human_review",
    "failed_unsupported_widget",
    "failed_repairable",
    "failed_browser_crash",
    "failed_network",
    "failed_user_input_required",
  ].includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
