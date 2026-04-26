// Headless-Chromium PDF generation. Local dev uses the system Chrome
// (LOCAL_CHROME_PATH or default Mac path). Vercel serverless uses
// @sparticuz/chromium-min, which downloads Chromium from a CDN at runtime.
//
// The browser is held in a module-level singleton so successive jobs
// reuse one Chromium process. On crash/disconnect we null the singleton
// so the next call rebuilds.

import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
export { textToPdf, toBase64 } from "./tailor/simple-pdf";

let browserPromise: Promise<Browser> | null = null;
let lastBrowserbaseSession: BrowserbaseSessionInfo | null = null;

export type BrowserbaseSessionInfo = {
  id: string;
  connectUrl?: string;
};

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

const MAC_CHROME_DEFAULT = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAC_CHROME_CANARY = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);
}

async function resolveExecutable(): Promise<{ args: string[]; executablePath: string }> {
  if (isServerless()) {
    return await resolvePackagedChromium();
  }
  const explicit = process.env.LOCAL_CHROME_PATH;
  const localExecutablePath = explicit || findLocalChromePath();
  if (!localExecutablePath) {
    throw new Error(
      "No local Chrome executable found. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID for cloud runs, or set LOCAL_CHROME_PATH for local runs."
    );
  }
  const normalLocalChrome = process.env.LOCAL_CHROME_NORMAL === "1";
  return {
    args: normalLocalChrome
      ? ["--no-first-run", "--no-default-browser-check"]
      : [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-sync",
        ],
    executablePath: localExecutablePath,
  };
}

function findLocalChromePath(): string | null {
  if (existsSync(MAC_CHROME_DEFAULT)) return MAC_CHROME_DEFAULT;
  if (existsSync(MAC_CHROME_CANARY)) return MAC_CHROME_CANARY;
  return null;
}

async function resolvePackagedChromium(): Promise<{ args: string[]; executablePath: string }> {
  const chromiumMin = (await import("@sparticuz/chromium-min")).default;
  const packUrl = process.env.CHROMIUM_PACK_URL || DEFAULT_CHROMIUM_PACK_URL;
  return {
    args: chromiumMin.args,
    executablePath: await chromiumMin.executablePath(packUrl),
  };
}

async function launchBrowser(): Promise<Browser> {
  const browser = isBrowserbaseConfigured()
    ? await connectBrowserbase()
    : await launchLocalBrowser();
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

async function launchLocalBrowser(): Promise<Browser> {
  const { args, executablePath } = await resolveExecutable();
  return await puppeteer.launch({
    args,
    defaultViewport: { width: 816, height: 1056 },
    executablePath,
    headless: process.env.LOCAL_CHROME_HEADLESS === "0" ? false : true,
    userDataDir: process.env.LOCAL_CHROME_USER_DATA_DIR || undefined,
  });
}

async function connectBrowserbase(): Promise<Browser> {
  const browserSettings = {
    solveCaptchas: isBrowserbaseCaptchaSolvingEnabled(),
    recordSession: true,
    logSession: true,
    verified: process.env.BROWSERBASE_VERIFIED === "1" ? true : undefined,
    captchaImageSelector: process.env.BROWSERBASE_CAPTCHA_IMAGE_SELECTOR || undefined,
    captchaInputSelector: process.env.BROWSERBASE_CAPTCHA_INPUT_SELECTOR || undefined,
  };
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BB-API-Key": process.env.BROWSERBASE_API_KEY ?? "",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      contextId: process.env.BROWSERBASE_CONTEXT_ID || undefined,
      keepAlive: process.env.BROWSERBASE_KEEP_ALIVE === "1" ? true : undefined,
      timeout: Number(process.env.BROWSERBASE_SESSION_TIMEOUT_SECONDS ?? "600"),
      proxies: process.env.BROWSERBASE_PROXIES === "1" ? true : undefined,
      browserSettings,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Browserbase session creation failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const session = (await response.json()) as { id?: string; connectUrl?: string };
  if (!session.connectUrl) {
    throw new Error(`Browserbase session did not return a connectUrl for session ${session.id ?? "unknown"}`);
  }
  if (session.id) {
    lastBrowserbaseSession = {
      id: session.id,
      connectUrl: session.connectUrl,
    };
  }
  return await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
}

export function isBrowserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID);
}

export function isBrowserbaseCaptchaSolvingEnabled(): boolean {
  return isBrowserbaseConfigured() && process.env.BROWSERBASE_SOLVE_CAPTCHAS !== "0";
}

export function getLastBrowserbaseSessionInfo(): BrowserbaseSessionInfo | null {
  return lastBrowserbaseSession;
}

export async function getBrowserbaseLiveViewUrls(sessionId = lastBrowserbaseSession?.id): Promise<{
  debuggerFullscreenUrl?: string;
  debuggerUrl?: string;
  pages?: Array<{ url?: string; title?: string; debuggerFullscreenUrl?: string; debuggerUrl?: string }>;
} | null> {
  if (!sessionId || !process.env.BROWSERBASE_API_KEY) return null;
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
    headers: {
      "X-BB-API-Key": process.env.BROWSERBASE_API_KEY,
    },
  });
  if (!response.ok) return null;
  return await response.json() as {
    debuggerFullscreenUrl?: string;
    debuggerUrl?: string;
    pages?: Array<{ url?: string; title?: string; debuggerFullscreenUrl?: string; debuggerUrl?: string }>;
  };
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function getPuppeteerBrowser(): Promise<Browser> {
  return await getBrowser();
}

export type HtmlToPdfOptions = {
  format?: "letter" | "a4";
  marginIn?: number;
  signal?: AbortSignal;
};

export async function htmlToPdf(html: string, opts: HtmlToPdfOptions = {}): Promise<Uint8Array> {
  const format = opts.format ?? "letter";
  const margin = `${opts.marginIn ?? 0.6}in`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // domcontentloaded resolves once HTML parses; for inline static markup
    // there are no external resources to wait for. networkidle0 has been
    // observed to hang in some Chrome builds when using setContent.
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    const buf = await page.pdf({
      format,
      printBackground: true,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });
    return buf;
  } finally {
    await page.close().catch(() => {});
  }
}
