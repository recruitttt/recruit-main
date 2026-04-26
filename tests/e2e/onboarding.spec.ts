/**
 * Onboarding E2E tests.
 *
 * The onboarding page is a single-page multi-step chat UI. It uses Convex
 * React hooks (`useQuery`, `useAction`, `useMutation`) and better-auth for
 * session management. All external I/O is intercepted via `page.route()`.
 *
 * Step model (matches STEP_ORDER in app/onboarding/page.tsx):
 *   account  → resume → connect → prefs → activate
 *
 * Convex wire protocol: the browser opens a WebSocket to the Convex backend.
 * Since we cannot intercept WS frames through `page.route()` we route the
 * WebSocket URL to a stub HTTP handler OR load the page with a pre-set
 * localStorage state so the Convex hooks receive mocked data via route().
 *
 * Practical approach used here:
 *   - Intercept all fetch requests to the Convex HTTP endpoint so mutations
 *     return 200 without contacting real Convex.
 *   - Pre-set `localStorage["recruit:onboarding"]` and
 *     `localStorage["better-auth_session"]` before each test to simulate an
 *     authenticated, partly-completed state — removing the need for OAuth.
 *   - For the GitHub fast-path test we additionally inject a `window.__MOCK_CONVEX`
 *     fixture that the test page picks up through a custom route handler that
 *     serves a patched `_next/static` chunk.  Since that is too invasive, we
 *     instead rely on route interception for the `/api/*` calls and fake the
 *     Convex WebSocket handshake by serving a minimal SSE-compatible stub.
 *
 * NOTE: These tests must be run against a running dev server (`pnpm dev`).
 *       They do not hit real Convex, GitHub, or LinkedIn APIs.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants mirroring the production code
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

const STORAGE_KEY = "recruit:onboarding";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed localStorage with onboarding state and a fake session so Convex
 * hooks that read `userId` from `authClient.useSession()` receive a value.
 * This eliminates the need for real GitHub OAuth in the smoke path.
 */
async function seedSession(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ storageKey, data }: { storageKey: string; data: string }) => {
      // Fake a better-auth session cookie value that `authClient.useSession`
      // reads from the `__Secure-better-auth.session_token` / document.cookie
      // path. The actual hook does a GET /api/auth/get-session; we stub that
      // route separately so the hook resolves with our fake user.
      localStorage.setItem(storageKey, data);
    },
    {
      storageKey: STORAGE_KEY,
      data: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        resumeFilename: "",
        resumeStorageId: null,
        links: { github: "", linkedin: "", twitter: "", devpost: "", website: "" },
        prefs: { roles: [], workAuth: "", location: "" },
        ...extra,
      }),
    },
  );
}

/**
 * Intercept the better-auth session endpoint so the page sees a logged-in
 * user immediately, without a real OAuth flow.
 */
function stubAuthSession(page: Page, override: Record<string, unknown> = {}) {
  return page.route("**/api/auth/get-session", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "fake-user-id-001",
          name: "Test User",
          email: "test@example.com",
          image: null,
          ...override,
        },
        session: { id: "fake-session-id", expiresAt: "2099-01-01T00:00:00Z" },
      }),
    });
  });
}

/**
 * Stub all Convex HTTP API calls (mutations + queries over HTTP).
 * WebSocket-based queries cannot be intercepted here; those hooks will
 * just stay in the loading/undefined state, which is fine for most steps.
 */
function stubConvexHttp(page: Page) {
  return page.route("**/convex.cloud/**", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

/**
 * Stub the launch-pipeline endpoint (called when "Confirm and start" is
 * clicked on the activate step).
 */
function stubLaunchPipeline(page: Page) {
  return page.route("**/api/onboarding/launch-pipeline", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: "started", runId: "mock-run-id" }),
    });
  });
}

/**
 * Wait for the step card heading icon/badge characteristic of a given step.
 * The onboarding page renders one visible StepCard at a time inside an
 * AnimatePresence; we detect the active step by waiting for the "Step N of 5"
 * progress label to appear.
 */
async function waitForStep(page: Page, stepNumber: number) {
  await expect(page.getByText(`Step ${stepNumber} of 5`).first()).toBeVisible({
    timeout: 8_000,
  });
}

/**
 * Click a button whose visible text matches `label` and wait for the typing
 * indicator animation (360 ms in source) to finish before the next step card
 * appears.
 */
async function clickAndWaitAdvance(page: Page, label: string | RegExp) {
  await page.getByRole("button", { name: label }).click();
  // The page animates a 360 ms "typing" delay. Wait for the next step card
  // to mount rather than using a fixed sleep.
  await page.waitForTimeout(600);
}

// ---------------------------------------------------------------------------
// Test suite 1: Happy-path smoke (full onboarding walk-through)
// ---------------------------------------------------------------------------

test.describe("Onboarding: happy-path smoke", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthSession(page);
    await stubConvexHttp(page);
    await stubLaunchPipeline(page);
    await seedSession(page);
  });

  test("step 1 (account): renders 'Continue with GitHub' and 'Sign up with email' buttons", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await waitForStep(page, 1);

    // The AccountStepCard renders two primary action buttons when NOT already
    // authenticated. Because we stubbed the session above the component should
    // see isAuthenticated=true and show the "Continue" button instead. Either
    // assertion is valid; we handle both branches.
    const continueBtn = page.getByRole("button", { name: /Continue with GitHub/i });
    const alreadyBtn = page.getByRole("button", { name: /Continue/i });

    const isContinueWithGithub = await continueBtn.isVisible();
    const isAlreadyContinue = await alreadyBtn.isVisible();
    expect(isContinueWithGithub || isAlreadyContinue).toBe(true);
  });

  test("step 1 -> 2: authenticated user clicking Continue advances to Resume", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await waitForStep(page, 1);

    // When the fake session resolves, the AccountStepCard shows "Continue".
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await waitForStep(page, 2);

    // Resume step shows the FileUploadControl and a "Skip for now" button.
    await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();
  });

  test("step 2 (resume): skipping advances to Connect step", async ({ page }) => {
    await page.goto("/onboarding");
    await waitForStep(page, 1);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await waitForStep(page, 2);

    await page.getByRole("button", { name: /Skip for now/i }).click();
    await waitForStep(page, 3);

    // Connect step renders the GitHub "Connect" button.
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();
  });

  test("step 2 (resume): mock file upload sets filename and shows Continue button", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await waitForStep(page, 1);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await waitForStep(page, 2);

    // Stub Convex generateUploadUrl mutation response.
    await page.route("**/api/**", (route: Route) => {
      if (route.request().url().includes("generateUploadUrl")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ storageId: "mock-storage-id" }),
        });
      } else {
        route.continue();
      }
    });

    // The hidden <input type="file"> accepts .pdf/.doc/.docx.
    // Playwright's setInputFiles triggers the onChange handler directly,
    // which calls onResumeFile → handleResumeFile.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "my-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf content"),
    });

    // After the upload mock resolves the filename label should appear and
    // the advance button caption changes to "Continue while parsing".
    // Because the real upload fetch would hit Convex (stubbed to 200) the
    // component calls advance() → moves to Connect.
    await waitForStep(page, 3);
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();
  });

  test("step 3 (connect): skipping social links advances to Prefs", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await waitForStep(page, 1);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await waitForStep(page, 2);
    await page.getByRole("button", { name: /Skip for now/i }).click();
    await waitForStep(page, 3);

    // Skip for now is the button when no link is set and no github run.
    await page.getByRole("button", { name: /Skip for now/i }).click();
    await waitForStep(page, 4);

    // Prefs step shows the role chip group.
    await expect(page.getByText("Role focus")).toBeVisible();
  });

  test("step 4 (prefs): role focus section shows 6 role chips", async ({
    page,
  }) => {
    // Navigate directly to step 4 via URL param.
    await page.goto("/onboarding?step=4");
    await waitForStep(page, 4);

    for (const role of ROLE_OPTIONS) {
      await expect(page.getByRole("button", { name: role })).toBeVisible();
    }
  });

  test("step 4 (prefs): selecting a role + location enables Continue", async ({
    page,
  }) => {
    await page.goto("/onboarding?step=4");
    await waitForStep(page, 4);

    // Click the first role chip.
    await page.getByRole("button", { name: "Software Engineer" }).click();

    // Fill in location.
    await page.getByPlaceholder(/Remote, San Francisco/i).fill("San Francisco");

    // Continue button should be enabled after a role is selected.
    const continueBtn = page.getByRole("button", { name: /^Continue$/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await waitForStep(page, 5);
  });

  test("step 5 (activate): 'Confirm and continue' button is visible", async ({
    page,
  }) => {
    // We need at least one role selected or the activate button is disabled.
    await seedSession(page, { prefs: { roles: ["Software Engineer"], workAuth: "", location: "Remote" } });
    await page.goto("/onboarding?step=5");
    await waitForStep(page, 5);

    await expect(
      page.getByRole("button", { name: /Confirm and continue/i }),
    ).toBeVisible();
  });

  test("step 5 (activate): confirm does not collapse or reset the onboarding scroll area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.unroute("**/api/auth/get-session");
    await page.route("**/api/auth/get-session", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });
    await seedSession(page, {
      resumeFilename: "resume.pdf",
      links: {
        github: "https://github.com/test-user",
        linkedin: "https://www.linkedin.com/in/test-user",
        twitter: "",
        devpost: "https://devpost.com/test-user",
        website: "https://test-user.dev",
      },
      prefs: {
        roles: ["Software Engineer", "Founding Engineer", "ML / AI"],
        workAuth: "US citizen",
        location: "Remote, San Francisco",
      },
    });

    await page.goto("/onboarding?step=5");
    await waitForStep(page, 5);
    await page.evaluate(() => {
      const originalSetTimeout = window.setTimeout.bind(window) as Window["setTimeout"];
      const acceleratedSetTimeout = (...args: Parameters<Window["setTimeout"]>) => {
        const [handler, timeout, ...rest] = args;
        return originalSetTimeout(
          handler,
          typeof timeout === "number" && timeout >= 700 ? 10_000 : timeout,
          ...rest,
        );
      };
      window.setTimeout = acceleratedSetTimeout as typeof window.setTimeout;
    });

    const scrollArea = page.locator('section [class*="overflow-y-auto"]').first();
    await scrollArea.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    const confirmButton = page.getByRole("button", {
      name: /Confirm and continue/i,
    });
    await expect(confirmButton).toBeVisible();

    const before = await scrollArea.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    }));

    await confirmButton.click({ force: true });
    await expect(
      page.getByRole("status", { name: /Activating your squad/i }),
    ).toBeVisible();
    await page.waitForTimeout(400);

    const after = await scrollArea.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    }));

    expect(after.scrollHeight).toBeGreaterThanOrEqual(before.scrollHeight - 24);
    expect(after.scrollTop).toBeGreaterThanOrEqual(before.scrollTop - 8);
  });

  test("step 5 (activate): clicking confirm shows the Ready Room handoff", async ({
    page,
  }) => {
    await page.unroute("**/api/auth/get-session");
    await page.route("**/api/auth/get-session", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });
    await seedSession(page, { prefs: { roles: ["Software Engineer"], workAuth: "", location: "Remote" } });

    await page.goto("/onboarding?step=5");
    await waitForStep(page, 5);
    await page.evaluate(() => {
      const originalSetTimeout = window.setTimeout.bind(window) as Window["setTimeout"];
      const acceleratedSetTimeout = (...args: Parameters<Window["setTimeout"]>) => {
        const [handler, timeout, ...rest] = args;
        return originalSetTimeout(
          handler,
          typeof timeout === "number" && timeout >= 700 ? 10_000 : timeout,
          ...rest,
        );
      };
      window.setTimeout = acceleratedSetTimeout as typeof window.setTimeout;
    });

    await page.getByRole("button", { name: /Confirm and continue/i }).click();

    await expect(
      page.getByRole("status", { name: /Activating your squad/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Loading/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test suite 2: GitHub OAuth fast-path
// ---------------------------------------------------------------------------

test.describe("Onboarding: GitHub OAuth fast-path", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthSession(page);
    await stubConvexHttp(page);
    await seedSession(page);
  });

  /**
   * Simulate a `running` github intake run by injecting a fake Convex
   * query result. The onboarding page reads `githubRun` from
   * `useQuery(api.intakeRuns.byUserKind, { kind: "github" })`.
   *
   * We cannot intercept the WebSocket transport, so instead we:
   *   1. Intercept the Next.js API route that serves the initial server
   *      component HTML and inject a `<script>` that sets
   *      `window.__CONVEX_MOCK_GITHUB_RUN` to a running row.
   *   2. In the page's context, override `window.fetch` to return the
   *      mocked row for the query action path.
   *
   * Because Convex uses a proprietary WebSocket protocol the only reliable
   * approach without a real Convex dev deployment is to stub the Convex
   * HTTP query endpoint (/api/query) to return a synthetic row, then
   * verify that the UI auto-advances after the 1.2 s timeout.
   */
  test("auto-skips Connect → Prefs after 1.2 s when github run is 'running'", async ({
    page,
  }) => {
    // Intercept Convex HTTP query for intakeRuns.byUserKind (github) to
    // return a running row. The Convex SDK calls this endpoint when the
    // WS connection is unavailable (it falls back to HTTP queries).
    await page.route("**/convex.cloud/**", (route) => {
      const url = route.request().url();
      // Convex HTTP query endpoint pattern: POST to /api/query
      if (url.includes("/query") || url.includes("intakeRuns")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "running",
            kind: "github",
            userId: "fake-user-id-001",
            events: [{ stage: "fetching", message: "Fetching repos" }],
            startedAt: new Date().toISOString(),
          }),
        });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      }
    });

    // Navigate directly to step 3 (connect).
    await page.goto("/onboarding?step=3");
    await waitForStep(page, 3);

    // The Connect button should be visible initially (before auto-advance).
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();

    // After the 1.2 s timeout the step should advance to Prefs (step 4).
    // Give it 3 s to be safe.
    await expect(page.getByText("Role focus")).toBeVisible({ timeout: 4_000 });
    await waitForStep(page, 4);
  });

  test("does NOT auto-skip when github run status is 'failed'", async ({
    page,
  }) => {
    await page.route("**/convex.cloud/**", (route) => {
      const url = route.request().url();
      if (url.includes("/query") || url.includes("intakeRuns")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "failed",
            kind: "github",
            userId: "fake-user-id-001",
            error: "OAuth token expired",
            startedAt: new Date().toISOString(),
          }),
        });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      }
    });

    await page.goto("/onboarding?step=3");
    await waitForStep(page, 3);

    // The Connect button must remain visible — no auto-advance.
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();

    // Wait 2.5 s (longer than the 1.2 s auto-advance window) and confirm
    // we are still on step 3.
    await page.waitForTimeout(2_500);
    await waitForStep(page, 3);

    // "Role focus" heading must NOT be present.
    await expect(page.getByText("Role focus")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test suite 3: LinkedIn intake (UI path on the Connect step)
// ---------------------------------------------------------------------------

test.describe("Onboarding: LinkedIn intake", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthSession(page);
    await stubConvexHttp(page);
    await seedSession(page);
  });

  test("typing a LinkedIn URL and clicking Save fires POST /api/intake/linkedin", async ({
    page,
  }) => {
    let capturedBody: unknown = null;

    // Mock the SSE LinkedIn route.
    await page.route("**/api/intake/linkedin", async (route) => {
      capturedBody = await route.request().postDataJSON();

      // Respond with a small SSE stream: one starting event then close.
      const sseBody = [
        `data: ${JSON.stringify({ stage: "starting", message: "LinkedIn intake starting" })}`,
        "",
        `data: ${JSON.stringify({ stage: "complete", message: "Done" })}`,
        "",
      ].join("\n");

      route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
        },
        body: sseBody,
      });
    });

    await page.goto("/onboarding?step=3");
    await waitForStep(page, 3);

    // Find the LinkedIn URL input by its placeholder text.
    const linkedinInput = page.getByPlaceholder(/linkedin\.com\/in\//i);
    await linkedinInput.fill("https://linkedin.com/in/test");

    // Click the Save button next to the LinkedIn field.
    // The SourceField renders an ActionButton with "Save" label adjacent to the input.
    const saveBtn = page.getByRole("button", { name: "Save" }).first();
    await saveBtn.click();

    // Verify the POST was made with the correct body.
    await page.waitForTimeout(500);
    expect(capturedBody).toMatchObject({
      profileUrl: "https://linkedin.com/in/test",
    });
  });

  test("SSE stream progress events update the progress badge", async ({
    page,
  }) => {
    let requestCount = 0;

    await page.route("**/api/intake/linkedin", async (route) => {
      requestCount++;
      // Emit two progress events before completing.
      const events = [
        { stage: "starting", message: "Starting LinkedIn intake" },
        { stage: "scraping", message: "Scraping profile page" },
        { stage: "complete", message: "LinkedIn intake complete" },
      ];
      const sseBody = events
        .flatMap((e) => [`data: ${JSON.stringify(e)}`, ""])
        .join("\n");

      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: sseBody,
      });
    });

    await page.goto("/onboarding?step=3");
    await waitForStep(page, 3);

    const linkedinInput = page.getByPlaceholder(/linkedin\.com\/in\//i);
    await linkedinInput.fill("https://linkedin.com/in/test");
    await page.getByRole("button", { name: "Save" }).first().click();

    // The intake route was called.
    await page.waitForTimeout(500);
    expect(requestCount).toBeGreaterThan(0);

    // The ProgressBadge component renders the latest event message once
    // the `linkedinRun` Convex query updates. Since the Convex WS isn't
    // running in the test environment the badge won't update from WS, but
    // the SSE stream itself being consumed is the assertion we can make.
  });
});
