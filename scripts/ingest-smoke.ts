#!/usr/bin/env tsx

import { INGESTION_PROVIDERS, type IngestionProvider } from "@/lib/ingestion/types";
import { runIngestionSmoke } from "@/lib/ingestion/smoke";

type CliOptions = {
  providers?: IngestionProvider[];
  limit?: number;
  concurrency?: number;
  sourcesPath?: string;
  outputRoot?: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { summary, artifactPath } = await runIngestionSmoke(options);

  console.log("Ingestion smoke run");
  console.log(`Providers: ${summary.providers.join(", ")}`);
  console.log(`Sources: ${summary.sourceCount}`);
  console.log(`Jobs: ${summary.dedupedJobCount} deduped from ${summary.rawJobCount} raw`);
  console.log(`Failures: ${summary.errors.length}`);
  for (const total of summary.providerTotals) {
    console.log(
      `- ${total.provider}: ${total.dedupedJobCount} jobs, ${total.okSourceCount}/${total.sourceCount} sources ok`
    );
  }
  console.log(`Artifact: ${artifactPath}`);

  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (const arg of args) {
    const [name, rawValue] = splitArg(arg);
    if (!name) continue;

    if (name === "providers") {
      const providers = rawValue.split(",").map((item) => item.trim()).filter(Boolean);
      options.providers = providers.map(parseProvider);
      continue;
    }
    if (name === "limit") {
      options.limit = parsePositiveInteger(rawValue, "limit");
      continue;
    }
    if (name === "concurrency") {
      options.concurrency = parsePositiveInteger(rawValue, "concurrency");
      continue;
    }
    if (name === "sources") {
      options.sourcesPath = rawValue;
      continue;
    }
    if (name === "output") {
      options.outputRoot = rawValue;
      continue;
    }

    throw new Error(`Unknown option --${name}`);
  }
  return options;
}

function splitArg(arg: string) {
  if (!arg.startsWith("--")) return ["", ""];
  const trimmed = arg.slice(2);
  const eq = trimmed.indexOf("=");
  if (eq === -1) return [trimmed, "true"];
  return [trimmed.slice(0, eq), trimmed.slice(eq + 1)];
}

function parseProvider(value: string): IngestionProvider {
  if ((INGESTION_PROVIDERS as readonly string[]).includes(value)) {
    return value as IngestionProvider;
  }
  throw new Error(`Unsupported provider ${value}`);
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
