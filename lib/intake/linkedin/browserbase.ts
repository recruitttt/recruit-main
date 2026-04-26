// Browserbase session helpers for the LinkedIn scraper.
//
// We connect to a Browserbase cloud Chrome session via Playwright over CDP.
// The session uses keep_alive so the same browser survives across re-runs
// (next invocation can re-attach and skip the captcha flow).
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2

import Browserbase from "@browserbasehq/sdk";
import { createHash } from "node:crypto";
import type { Browser, BrowserContext } from "playwright-core";
import { chromium } from "playwright-core";

const DEFAULT_API_TIMEOUT_SECONDS = 1800; // 30 min — matches the Python source.

export interface MakeBrowserbaseSessionInput {
  apiKey: string;
  projectId: string;
  /** Reuse an existing session id (skips create + captcha clearance). */
  reuseSessionId?: string;
  /** Browserbase keep_alive flag. Defaults to true. */
  keepAlive?: boolean;
  /** Project-level timeout in seconds. Defaults to 1800. */
  apiTimeoutSeconds?: number;
}

export interface BrowserbaseSessionHandle {
  sessionId: string;
  /** Non-secret project/key diagnostics for runtime config debugging. */
  diagnostics: BrowserbaseRuntimeDiagnostics;
  /** Live debugger URL (set when we minted a fresh session). */
  liveViewUrl?: string;
  /** Connected Playwright browser. Caller owns close(). */
  browser: Browser;
  /** Default Playwright context attached to the cloud Chrome. */
  context: BrowserContext;
  /** Underlying Browserbase SDK client (for follow-up debug calls). */
  client: Browserbase;
}

export interface BrowserbaseRuntimeDiagnostics {
  apiKeyFingerprint: string;
  projectId: string;
  projectName?: string;
  concurrency?: number;
  defaultTimeout?: number;
  browserMinutes?: number;
  proxyBytes?: number;
}

export function browserbaseKeyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}

export function formatBrowserbaseDiagnostics(
  diagnostics: BrowserbaseRuntimeDiagnostics
): string {
  const parts = [
    `project=${diagnostics.projectId}`,
    `key=${diagnostics.apiKeyFingerprint}`,
  ];
  if (diagnostics.projectName) parts.push(`name=${diagnostics.projectName}`);
  if (diagnostics.concurrency !== undefined) {
    parts.push(`concurrency=${diagnostics.concurrency}`);
  }
  if (diagnostics.defaultTimeout !== undefined) {
    parts.push(`defaultTimeout=${diagnostics.defaultTimeout}`);
  }
  if (diagnostics.browserMinutes !== undefined) {
    parts.push(`browserMinutes=${diagnostics.browserMinutes}`);
  }
  return parts.join(" ");
}

async function getRuntimeDiagnostics(
  client: Browserbase,
  apiKey: string,
  projectId: string
): Promise<BrowserbaseRuntimeDiagnostics> {
  const [project, usage] = await Promise.all([
    client.projects.retrieve(projectId),
    client.projects.usage(projectId),
  ]);

  return {
    apiKeyFingerprint: browserbaseKeyFingerprint(apiKey),
    projectId,
    projectName: project.name,
    concurrency: project.concurrency,
    defaultTimeout: project.defaultTimeout,
    browserMinutes: usage.browserMinutes,
    proxyBytes: usage.proxyBytes,
  };
}

/**
 * Create (or re-attach to) a Browserbase session and return a connected
 * Playwright `BrowserContext`. The caller MUST `await handle.browser.close()`
 * when done — that disconnects from the cloud session but, with keep_alive,
 * leaves the cloud Chrome running for re-attachment.
 */
export async function makeBrowserbaseSession(
  input: MakeBrowserbaseSessionInput
): Promise<BrowserbaseSessionHandle> {
  if (!input.apiKey) {
    throw new Error("makeBrowserbaseSession: BROWSERBASE_API_KEY is required");
  }
  if (!input.projectId) {
    throw new Error("makeBrowserbaseSession: BROWSERBASE_PROJECT_ID is required");
  }

  const client = new Browserbase({ apiKey: input.apiKey });
  let diagnostics: BrowserbaseRuntimeDiagnostics;
  try {
    diagnostics = await getRuntimeDiagnostics(
      client,
      input.apiKey,
      input.projectId
    );
  } catch (err) {
    throw new Error(
      `browserbase_config_check_failed: ${errorMessage(err)}. ` +
        `runtime=${formatBrowserbaseDiagnostics({
          apiKeyFingerprint: browserbaseKeyFingerprint(input.apiKey),
          projectId: input.projectId,
        })}. Verify BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in the Next.js runtime environment, then restart/redeploy.`
    );
  }

  let sessionId: string;
  let connectUrl: string;

  if (input.reuseSessionId) {
    const session = await client.sessions.retrieve(input.reuseSessionId);
    if (session.status !== "RUNNING") {
      throw new Error(
        `Browserbase session ${input.reuseSessionId} status is ${session.status}, not RUNNING`
      );
    }
    sessionId = session.id;
    if (!session.connectUrl) {
      throw new Error(
        `Browserbase session ${sessionId} did not return a connectUrl`
      );
    }
    connectUrl = session.connectUrl;
  } else {
    // The SDK's typed `SessionCreateParams.BrowserSettings` does not surface
    // the `fingerprint` knob (browser/device/OS/locale tuning) even though the
    // REST API accepts it. We forward it anyway via a structural cast so we
    // get residential-IP Chrome with a real fingerprint, matching the Python
    // implementation we ported from.
    let session;
    try {
      session = await client.sessions.create({
        projectId: input.projectId,
        keepAlive: input.keepAlive ?? true,
        browserSettings: {
          blockAds: true,
          solveCaptchas: true,
          viewport: { width: 1440, height: 900 },
          // Forwarded structurally — see comment above.
          fingerprint: {
            browsers: ["chrome"],
            devices: ["desktop"],
            operatingSystems: ["macos"],
            locales: ["en-US"],
          },
        } as Record<string, unknown>,
        // `timeout` is in seconds and bounded by the project default. Browserbase
        // ends the session after this elapses regardless of activity.
        timeout: input.apiTimeoutSeconds ?? DEFAULT_API_TIMEOUT_SECONDS,
      });
    } catch (err) {
      throw new Error(
        `browserbase_session_create_failed: ${errorMessage(err)}. ` +
          `runtime=${formatBrowserbaseDiagnostics(diagnostics)}. ` +
          "If Browserbase reports a Free plan here, this deployed/server process is not using the paid key/project you updated locally."
      );
    }
    sessionId = session.id;
    if (!session.connectUrl) {
      throw new Error(`Browserbase did not return a connectUrl for new session ${sessionId}`);
    }
    connectUrl = session.connectUrl;
  }

  let liveViewUrl: string | undefined;
  try {
    liveViewUrl = await getDebuggerUrl(client, sessionId);
  } catch {
    liveViewUrl = undefined;
  }

  // Browserbase exposes the cloud Chrome's CDP endpoint as `connectUrl`.
  const browser = await chromium.connectOverCDP(connectUrl);
  const contexts = browser.contexts();
  const context = contexts[0] ?? (await browser.newContext());

  return { sessionId, diagnostics, liveViewUrl, browser, context, client };
}

/**
 * Returns the most useful live-view URL for a Browserbase session. Prefers
 * `debuggerFullscreenUrl` over `debuggerUrl`. Returns undefined if Browserbase
 * is unable to provide one (e.g. session ended).
 */
export async function getDebuggerUrl(
  client: Browserbase,
  sessionId: string
): Promise<string | undefined> {
  try {
    const debug = await client.sessions.debug(sessionId);
    return debug.debuggerFullscreenUrl ?? debug.debuggerUrl ?? undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
