// Headless-Chromium PDF generation. Local dev uses the system Chrome
// (LOCAL_CHROME_PATH or default Mac path). Vercel serverless uses
// @sparticuz/chromium-min, which downloads Chromium from a CDN at runtime.
//
// The browser is held in a module-level singleton so successive jobs
// reuse one Chromium process. On crash/disconnect we null the singleton
// so the next call rebuilds.

import puppeteer, { type Browser } from "puppeteer-core";

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

export function toBase64(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

export function textToPdf(text: string): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const lineHeight = 14;
  const maxLines = Math.floor((pageHeight - margin * 2) / lineHeight);
  const lines = wrapPdfText(text || "Tailored resume", 92);
  const pages = chunk(lines.length > 0 ? lines : ["Tailored resume"], maxLines);
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = [
      "BT",
      "/F1 10 Tf",
      `${margin} ${pageHeight - margin} Td`,
      ...pageLines.flatMap((line, lineIndex) => [
        lineIndex === 0 ? "" : `0 -${lineHeight} Td`,
        `(${escapePdfText(line)}) Tj`,
      ]).filter(Boolean),
      "ET",
    ].join("\n");

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  const offsets: number[] = [0];
  let body = "%PDF-1.4\n";
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

function wrapPdfText(text: string, width: number): string[] {
  const normalized = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of normalized) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
