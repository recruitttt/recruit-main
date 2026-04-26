// Headless-Chromium PDF generation. Local dev uses the system Chrome
// (LOCAL_CHROME_PATH or default Mac path). Vercel serverless uses
// @sparticuz/chromium-min, which downloads Chromium from a CDN at runtime.
//
// The browser is held in a module-level singleton so successive jobs
// reuse one Chromium process. On crash/disconnect we null the singleton
// so the next call rebuilds.

import puppeteer, { type Browser } from "puppeteer-core";
export { textToPdf, toBase64 } from "@/lib/tailor/simple-pdf";

let browserPromise: Promise<Browser> | null = null;

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

const MAC_CHROME_DEFAULT = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAC_CHROME_CANARY = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);
}

async function resolveExecutable(): Promise<{ args: string[]; executablePath: string }> {
  if (isServerless()) {
    // Lazy import so the local-dev path doesn't pay the cost.
    const chromiumMin = (await import("@sparticuz/chromium-min")).default;
    const packUrl = process.env.CHROMIUM_PACK_URL || DEFAULT_CHROMIUM_PACK_URL;
    return {
      args: chromiumMin.args,
      executablePath: await chromiumMin.executablePath(packUrl),
    };
  }
  const explicit = process.env.LOCAL_CHROME_PATH;
  return {
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
    ],
    executablePath: explicit || MAC_CHROME_DEFAULT || MAC_CHROME_CANARY,
  };
}

async function launchBrowser(): Promise<Browser> {
  const { args, executablePath } = await resolveExecutable();
  const browser = await puppeteer.launch({
    args,
    defaultViewport: { width: 816, height: 1056 },
    executablePath,
    headless: true,
  });
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
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
