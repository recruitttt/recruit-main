import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  getLastBrowserbaseSessionInfo,
  getPuppeteerBrowser,
  isBrowserbaseCaptchaSolvingEnabled,
  isBrowserbaseConfigured,
} from "../../lib/pdf";

type CaptchaKind = "recaptcha" | "hcaptcha" | "lever_hcaptcha";

type CaptchaProbeConfig = {
  kind: CaptchaKind;
  url: string;
  tokenSelector: string;
  trigger: "none" | "lever_location_focus" | "visible_submit";
};

type CaptchaProbeResult = {
  kind: CaptchaKind;
  url: string;
  browserbaseSessionId: string | null;
  startedCount: number;
  finishedCount: number;
  tokenLengths: number[];
  captchaFrameCount: number;
  capable: boolean;
  durationMs: number;
  notes: string[];
  solverSamples: Array<Record<string, unknown>>;
  error?: string;
};

const root = process.cwd();
loadEnvConfig(root);

const runDir = `${root}/manual-runs/lever-batch-2026-04-26`;
const outputDir = `${runDir}/results`;
mkdirSync(outputDir, { recursive: true });

const label = flagValue("--label") ?? `captcha-capability-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const waitMs = Number(flagValue("--wait-ms") ?? "70000");
const leverUrl = flagValue("--lever-url");

if (!isBrowserbaseConfigured()) {
  throw new Error("BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required");
}
if (!isBrowserbaseCaptchaSolvingEnabled()) {
  throw new Error("Browserbase CAPTCHA solving is disabled; unset BROWSERBASE_SOLVE_CAPTCHAS=0");
}

const probes: CaptchaProbeConfig[] = [
  {
    kind: "recaptcha",
    url: "https://www.google.com/recaptcha/api2/demo",
    tokenSelector: "[name='g-recaptcha-response']",
    trigger: "none",
  },
  {
    kind: "hcaptcha",
    url: "https://accounts.hcaptcha.com/demo",
    tokenSelector: "[name='h-captcha-response']",
    trigger: "none",
  },
  ...(leverUrl
    ? [{
        kind: "lever_hcaptcha" as const,
        url: leverUrl,
        tokenSelector: "#hcaptchaResponseInput, [name='h-captcha-response']",
        trigger: "lever_location_focus" as const,
      }]
    : []),
];

async function main() {
  const results: CaptchaProbeResult[] = [];
  for (const probe of probes) {
    const result = await runProbe(probe, waitMs);
    results.push(result);
    writeFileSync(join(outputDir, `${label}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({
      kind: result.kind,
      capable: result.capable,
      startedCount: result.startedCount,
      finishedCount: result.finishedCount,
      tokenLengths: result.tokenLengths,
      browserbaseSessionId: result.browserbaseSessionId,
      error: result.error,
    }));
  }
}

async function runProbe(config: CaptchaProbeConfig, timeoutMs: number): Promise<CaptchaProbeResult> {
  const startedAt = Date.now();
  const notes: string[] = [];
  const solverSamples: Array<Record<string, unknown>> = [];
  let browser: Awaited<ReturnType<typeof getPuppeteerBrowser>> | null = null;
  let page: Awaited<ReturnType<Awaited<ReturnType<typeof getPuppeteerBrowser>>["newPage"]>> | null = null;
  let startedCount = 0;
  let finishedCount = 0;
  let tokenLengths: number[] = [];
  let captchaFrameCount = 0;

  try {
    browser = await getPuppeteerBrowser();
    page = await browser.newPage();
    page.on?.("console", (message: { text(): string }) => {
      const text = message.text();
      if (text === "browserbase-solving-started") startedCount += 1;
      if (text === "browserbase-solving-finished") finishedCount += 1;
      if (text.includes("browserbase") || text.includes("captcha")) notes.push(`console:${text}`);
    });

    const cdp = await page.target?.().createCDPSession?.();
    if (cdp) {
      await cdp.send("Network.enable");
      cdp.on("Network.responseReceived", async (event: {
        requestId: string;
        response: { url: string; status: number; mimeType?: string };
      }) => {
        if (!event.response.url.includes("/solve/")) return;
        const sample: Record<string, unknown> = {
          url: event.response.url.replace(/\\?.*$/, ""),
          status: event.response.status,
          mimeType: event.response.mimeType,
        };
        try {
          const body = await cdp.send("Network.getResponseBody", { requestId: event.requestId });
          sample.body = sanitizeSolverBody(body.body);
        } catch {
          sample.body = "unavailable";
        }
        if (solverSamples.length < 20) solverSamples.push(sample);
      });
    }

    await page.goto(config.url, { waitUntil: "networkidle2", timeout: 45_000 }).catch(async () => {
      await page?.goto(config.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    });
    await triggerProbe(page, config);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await probeState(page, config.tokenSelector);
      tokenLengths = state.tokenLengths;
      captchaFrameCount = state.captchaFrameCount;
      if (finishedCount > 0 || tokenLengths.some((length) => length > 0)) break;
      await wait(1000);
    }

    const capable = finishedCount > 0 && tokenLengths.some((length) => length > 0);
    return {
      kind: config.kind,
      url: config.url,
      browserbaseSessionId: getLastBrowserbaseSessionInfo()?.id ?? null,
      startedCount,
      finishedCount,
      tokenLengths,
      captchaFrameCount,
      capable,
      durationMs: Date.now() - startedAt,
      notes,
      solverSamples,
    };
  } catch (error) {
    return {
      kind: config.kind,
      url: config.url,
      browserbaseSessionId: getLastBrowserbaseSessionInfo()?.id ?? null,
      startedCount,
      finishedCount,
      tokenLengths,
      captchaFrameCount,
      capable: false,
      durationMs: Date.now() - startedAt,
      notes,
      solverSamples,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await closeWithTimeout(page);
    await closeWithTimeout(browser);
  }
}

async function triggerProbe(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getPuppeteerBrowser>>["newPage"]>>,
  config: CaptchaProbeConfig
) {
  if (config.trigger === "lever_location_focus") {
    await page.waitForSelector("#location-input", { timeout: 30_000 });
    await page.focus("#location-input");
    return;
  }
  if (config.trigger === "visible_submit") {
    await page.waitForSelector("#btn-submit, [data-qa='btn-submit'], button[type='submit']", { timeout: 30_000 });
    await page.click("#btn-submit, [data-qa='btn-submit'], button[type='submit']");
  }
}

async function probeState(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getPuppeteerBrowser>>["newPage"]>>,
  tokenSelector: string
) {
  return await page.evaluate(
    ({ tokenSelector }) => ({
      tokenLengths: Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(tokenSelector))
        .map((element) => element.value.length),
      captchaFrameCount: Array.from(document.querySelectorAll("iframe"))
        .filter((iframe) => /captcha/i.test(iframe.src)).length,
    }),
    { tokenSelector }
  );
}

function sanitizeSolverBody(body: string): unknown {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
      if (/token|response|solution/i.test(key)) {
        return [key, typeof value === "string" ? `string:${value.length}` : typeof value];
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, sanitizeNestedObject(value as Record<string, unknown>)];
      }
      return [key, value];
    }));
  } catch {
    return body.slice(0, 200);
  }
}

function sanitizeNestedObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/token|response|solution/i.test(key)) {
      return [key, typeof item === "string" ? `string:${item.length}` : typeof item];
    }
    return [key, item];
  }));
}

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

async function closeWithTimeout(target: { close(): Promise<unknown> } | null | undefined) {
  if (!target) return;
  await Promise.race([
    target.close().catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
}

function wait(timeoutMs: number) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
