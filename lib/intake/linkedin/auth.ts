// LinkedIn authentication for Playwright pages.
//
// Three modes (resolved in this order, matching the Python source):
//   1. li_at cookie present → inject + verify against /feed/
//   2. email + password → fill #username + #password + handle PIN challenge
//   3. fallback → return { needsLiveView: true } so the adapter surfaces the
//      Browserbase debugger URL via a `level: warn` event.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2.

import type { BrowserContext, Page } from "playwright-core";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import path from "node:path";

const FEED_URL = "https://www.linkedin.com/feed/";
const LOGIN_URL = "https://www.linkedin.com/login";
const ROBOTS_URL = "https://www.linkedin.com/robots.txt";

const PIN_POLL_INTERVAL_MS = 2_000;
const PIN_TIMEOUT_MS = 15 * 60_000; // 15 minutes — long-running Convex action ceiling

const SESSION_TIMEOUT_MS = 30_000;

/**
 * Build the per-session PIN file path. We never share a single global path
 * across sessions because two concurrent intakes would race on the same file
 * — the first user's PIN could be submitted to the second user's browser.
 *
 * Resolution order:
 *   1. `LINKEDIN_CHALLENGE_PIN_DIR` env (a directory)
 *   2. `os.tmpdir()` for cross-platform safety (Linux=/tmp, macOS=/var/...,
 *      Windows=%TEMP%)
 *
 * The filename is always namespaced by `sessionId`.
 */
export function challengePinPathFor(sessionId: string): string {
  const dirEnv = (process.env.LINKEDIN_CHALLENGE_PIN_DIR ?? "").trim();
  const dir = dirEnv || os.tmpdir();
  const safeId = sessionId.replace(/[^A-Za-z0-9_-]/g, "_") || "anon";
  return path.join(dir, `li_challenge_pin_${safeId}.txt`);
}

export interface AuthInput {
  liAt?: string | null;
  email?: string | null;
  password?: string | null;
  /**
   * Per-session ID used to derive a unique PIN file path. Required when the
   * caller wants to support concurrent intakes safely. If both `sessionId`
   * and `challengePinPath` are omitted we fall back to a tmpdir path tagged
   * with `"default"`.
   */
  sessionId?: string;
  /**
   * Explicit PIN file path. When provided, overrides the derived
   * `sessionId`-based path. Prefer passing `sessionId` so the auth layer can
   * apply env overrides + cross-platform tmpdir resolution.
   */
  challengePinPath?: string;
  /** Live-view URL to surface to the user when we hit a manual step. */
  liveViewUrl?: string;
}

export type AuthOutcome =
  | {
      status: "ok";
      mode: "cookie" | "password";
      /** Fresh li_at extracted from the context after a successful login. */
      liAt: string;
      jsessionId?: string;
    }
  | {
      status: "challenge";
      challengeKind: "email-pin";
      challengePinPath: string;
      liveViewUrl?: string;
    }
  | {
      status: "needs-live-view";
      liveViewUrl?: string;
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
    };

/**
 * Authenticate `page`'s context against LinkedIn. The page is left on
 * /feed/ on success.
 */
export async function authenticate(
  page: Page,
  input: AuthInput
): Promise<AuthOutcome> {
  const context = page.context();

  // ---- 1. Cookie path ------------------------------------------------------
  if (input.liAt && input.liAt.trim()) {
    const liAt = input.liAt.trim().replace(/^['"]|['"]$/g, "");
    await injectLiAtCookie(context, liAt);
    const verified = await verifyFeedAccess(page);
    if (verified) {
      const fresh = await readLiAtFromContext(context);
      const jsession = await readJsessionId(context);
      return {
        status: "ok",
        mode: "cookie",
        liAt: fresh ?? liAt,
        jsessionId: jsession ?? undefined,
      };
    }
    // Cookie was rejected — fall through to password.
  }

  // ---- 2. Password path ----------------------------------------------------
  if (input.email && input.password) {
    const pinPath =
      input.challengePinPath ?? challengePinPathFor(input.sessionId ?? "default");
    const result = await passwordLogin(page, {
      email: input.email,
      password: input.password,
      challengePinPath: pinPath,
      liveViewUrl: input.liveViewUrl,
    });
    if (result) return result;
  }

  // ---- 3. Live-view fallback ----------------------------------------------
  return {
    status: "needs-live-view",
    liveViewUrl: input.liveViewUrl,
    reason: "no usable credentials (cookie rejected or absent; no password)",
  };
}

// ---------------------------------------------------------------------------
// Cookie path helpers.
// ---------------------------------------------------------------------------

async function injectLiAtCookie(context: BrowserContext, liAt: string): Promise<void> {
  // Hit a tiny static endpoint to establish the linkedin.com origin in
  // Chromium's cookie jar before adding the cookie.
  const tmpPage = await context.newPage();
  try {
    await tmpPage.goto(ROBOTS_URL, { timeout: SESSION_TIMEOUT_MS, waitUntil: "domcontentloaded" }).catch(() => undefined);
  } finally {
    await tmpPage.close().catch(() => undefined);
  }
  await context.clearCookies().catch(() => undefined);
  await context.addCookies([
    {
      name: "li_at",
      value: liAt,
      domain: ".linkedin.com",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "None",
    },
  ]);
}

async function verifyFeedAccess(page: Page): Promise<boolean> {
  try {
    await page.goto(FEED_URL, { timeout: SESSION_TIMEOUT_MS, waitUntil: "domcontentloaded" });
  } catch {
    // Network-level timeout. Treat as failure but not fatal.
    return false;
  }

  // After /feed/ resolves, check if Chromium ended up at a login wall or
  // in a redirect loop.
  const url = page.url();
  if (url.includes("/login") || url.includes("/authwall") || url.includes("/checkpoint") || url.includes("/uas/")) {
    return false;
  }
  // Make sure the li_at cookie still exists in the jar — LinkedIn invalidates
  // it on rejection.
  const cookies = await page.context().cookies("https://www.linkedin.com");
  return cookies.some((c) => c.name === "li_at" && c.value);
}

async function readLiAtFromContext(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies("https://www.linkedin.com");
  return cookies.find((c) => c.name === "li_at")?.value ?? null;
}

async function readJsessionId(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies("https://www.linkedin.com");
  return cookies.find((c) => c.name === "JSESSIONID")?.value ?? null;
}

// ---------------------------------------------------------------------------
// Password path.
// ---------------------------------------------------------------------------

interface PasswordLoginInput {
  email: string;
  password: string;
  challengePinPath: string;
  liveViewUrl?: string;
}

async function passwordLogin(
  page: Page,
  input: PasswordLoginInput
): Promise<AuthOutcome | null> {
  try {
    await page.goto(LOGIN_URL, { timeout: SESSION_TIMEOUT_MS, waitUntil: "domcontentloaded" });
  } catch {
    return {
      status: "needs-live-view",
      liveViewUrl: input.liveViewUrl,
      reason: "navigation to /login timed out",
    };
  }

  try {
    await page.waitForSelector("#username", { timeout: SESSION_TIMEOUT_MS });
  } catch {
    return {
      status: "needs-live-view",
      liveViewUrl: input.liveViewUrl,
      reason: "login form did not appear (likely captcha wall)",
    };
  }

  try {
    await page.fill("#username", input.email);
    await page.fill("#password", input.password);
    const submitSelector = "button[type='submit'], button.btn__primary--large";
    await page.click(submitSelector);
  } catch (e) {
    return {
      status: "failed",
      reason: `login form interaction failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Wait for redirect off /login (success) OR a checkpoint URL.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (!url.includes("/login") && !url.includes("/uas/login")) break;
    await page.waitForTimeout(500);
  }

  let url = page.url();
  if (url.includes("/checkpoint/challenge") || url.includes("/checkpoint/lg/login-submit")) {
    const challengeResult = await handlePinChallenge(page, input);
    if (challengeResult.status !== "ok") return challengeResult;
    url = page.url();
  }

  if (url.includes("/login")) {
    return {
      status: "failed",
      reason: `login did not complete (still on ${url})`,
    };
  }

  const liAt = await readLiAtFromContext(page.context());
  if (!liAt) {
    return {
      status: "failed",
      reason: "login submitted but no li_at cookie was issued",
    };
  }
  const jsession = await readJsessionId(page.context());
  return {
    status: "ok",
    mode: "password",
    liAt,
    jsessionId: jsession ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Email-PIN challenge — read the PIN from a file the user writes to.
// ---------------------------------------------------------------------------

type ChallengeContext = PasswordLoginInput;

async function handlePinChallenge(
  page: Page,
  input: ChallengeContext
): Promise<AuthOutcome> {
  // Wait until either:
  //   - a PIN file appears + we successfully submit it, OR
  //   - the user clears the challenge through the live-view URL, OR
  //   - we time out.
  try {
    const deadline = Date.now() + PIN_TIMEOUT_MS;
    let lastTriedPin: string | null = null;

    while (Date.now() < deadline) {
      const url = page.url();
      if (!url.includes("/checkpoint") && !url.includes("/login")) {
        const liAt = await readLiAtFromContext(page.context());
        if (liAt) {
          const jsession = await readJsessionId(page.context());
          return { status: "ok", mode: "password", liAt, jsessionId: jsession ?? undefined };
        }
      }

      const pin = await readPinFile(input.challengePinPath);
      if (pin && pin !== lastTriedPin && page.url().includes("/checkpoint")) {
        const submitted = await enterPin(page, pin);
        if (submitted) {
          lastTriedPin = pin;
          // Give the form a few seconds to navigate.
          await page.waitForTimeout(3_000);
        }
      }

      await page.waitForTimeout(PIN_POLL_INTERVAL_MS);
    }

    return {
      status: "challenge",
      challengeKind: "email-pin",
      challengePinPath: input.challengePinPath,
      liveViewUrl: input.liveViewUrl,
    };
  } finally {
    // Best-effort cleanup. Leaving stale PINs on disk would (a) leak the
    // 6-digit code to other users of this host and (b) cause the next intake
    // run to immediately submit an old code.
    await fs.unlink(input.challengePinPath).catch(() => {});
  }
}

async function readPinFile(path: string): Promise<string | null> {
  try {
    const contents = await fs.readFile(path, "utf-8");
    const trimmed = contents.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

async function enterPin(page: Page, pin: string): Promise<boolean> {
  const inputSelector =
    "input[type='text'], input[type='tel'], input[type='number'], input[name='pin'], input#input__email_verification_pin";
  const input = await page.$(inputSelector);
  if (!input) return false;
  try {
    await input.fill("");
    await input.fill(pin);
  } catch {
    return false;
  }
  const submit =
    (await page.$("button#email-pin-submit-button")) ??
    (await page.$("button[type='submit']")) ??
    (await page.$("button.btn__primary--large"));
  if (!submit) return false;
  try {
    await submit.click();
    return true;
  } catch {
    return false;
  }
}
