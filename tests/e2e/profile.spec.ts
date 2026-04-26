/**
 * Profile page E2E tests.
 *
 * The `/profile` page is a server component that:
 *   - Redirects unauthenticated users to /sign-in.
 *   - Renders a sticky Data / Graph toggle (tab list with aria roles).
 *   - Mounts <DataView> (7 SectionCards: header, identity, experience,
 *     education, projects, skills, extras, debug) when view=data (default).
 *   - Mounts <GraphView> (react-force-graph-2d on a <canvas>) when view=graph.
 *   - Both subtrees remain mounted (display:none toggling), so subscriptions
 *     survive a tab flip.
 *
 * Auth is stubbed via the better-auth GET /api/auth/get-session endpoint.
 * Convex queries are stubbed via HTTP route interception.
 *
 * The section headers ("01 · Identity", "02 · Experience", etc.) are rendered
 * by SectionCard's `kicker` prop. We assert 7 of them are present in data view.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function stubAuthSession(page: Page) {
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
        },
        session: { id: "fake-session-id", expiresAt: "2099-01-01T00:00:00Z" },
      }),
    });
  });
}

/**
 * Return a minimal Convex userProfile row so the DataView sections render
 * with placeholder content rather than blank empty states.
 */
function makeProfileRow() {
  return {
    _id: "profile-row-001",
    userId: "fake-user-id-001",
    updatedAt: new Date().toISOString(),
    profile: {
      name: "Test User",
      email: "test@example.com",
      headline: "Senior Software Engineer",
      location: "San Francisco, CA",
      summary: "A seasoned engineer with broad full-stack experience.",
      skills: ["TypeScript", "React", "Node.js"],
      links: { github: "https://github.com/testuser" },
      experience: [
        {
          company: "Acme Corp",
          title: "Software Engineer",
          startDate: "2021-01",
          endDate: "2023-06",
          description: "Built things.",
          location: "Remote",
        },
      ],
      education: [
        {
          school: "State University",
          degree: "B.Sc.",
          field: "Computer Science",
          startDate: "2017",
          endDate: "2021",
        },
      ],
      github: {
        topRepos: [
          {
            name: "my-repo",
            url: "https://github.com/testuser/my-repo",
            description: "A sample repo",
            stars: 42,
            language: "TypeScript",
          },
        ],
      },
    },
    provenance: { name: "github", email: "github", headline: "linkedin" },
    log: [],
  };
}

function stubConvexQueries(page: Page) {
  const profileRow = makeProfileRow();

  return page.route("**/convex.cloud/**", (route) => {
    const url = route.request().url();

    if (url.includes("userProfiles") || url.includes("byUser")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profileRow),
      });
      return;
    }

    if (url.includes("intakeRuns") || url.includes("byUserKind")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          _id: "run-001",
          status: "completed",
          kind: "github",
          userId: "fake-user-id-001",
          startedAt: "2026-01-01T00:00:00Z",
          completedAt: "2026-01-01T00:01:00Z",
          events: [{ stage: "done", message: "Completed" }],
        }),
      });
      return;
    }

    if (url.includes("repoSummaries") || url.includes("listByUser")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    // All other Convex calls: return generic success.
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests: /profile?view=data (default)
// ---------------------------------------------------------------------------

test.describe("Profile page: data view", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthSession(page);
    await stubConvexQueries(page);
  });

  test("renders Data / Graph toggle with data view active by default", async ({
    page,
  }) => {
    await page.goto("/profile");

    // The toggle is a role=tablist with two role=tab children.
    const tablist = page.getByRole("tablist", { name: /Profile view mode/i });
    await expect(tablist).toBeVisible();

    const dataTab = page.getByRole("tab", { name: /Data view/i });
    const graphTab = page.getByRole("tab", { name: /Graph view/i });

    await expect(dataTab).toBeVisible();
    await expect(graphTab).toBeVisible();

    // Data tab is the default active tab (aria-selected=true).
    await expect(dataTab).toHaveAttribute("aria-selected", "true");
    await expect(graphTab).toHaveAttribute("aria-selected", "false");
  });

  test("renders the 7 SectionCard kicker headers in data view", async ({
    page,
  }) => {
    await page.goto("/profile");

    // SectionCard renders the kicker as a small label. The DataView creates:
    // "01 · Identity", "02 · Experience", "03 · Education", "04 · Projects",
    // "05 · Skills", "06 · Extras", "99 · Debug"
    const expectedKickers = [
      "01 · Identity",
      "02 · Experience",
      "03 · Education",
      "04 · Projects",
      "05 · Skills",
      "06 · Extras",
      "99 · Debug",
    ];

    for (const kicker of expectedKickers) {
      await expect(page.getByText(kicker)).toBeVisible({ timeout: 8_000 });
    }
  });

  test("displays profile name and headline in the header card", async ({
    page,
  }) => {
    await page.goto("/profile");

    // The HeaderCard renders the name in an <h1> and the headline below it.
    await expect(page.getByRole("heading", { name: "Test User" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText("Senior Software Engineer")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tests: /profile?view=graph
// ---------------------------------------------------------------------------

test.describe("Profile page: graph view", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthSession(page);
    await stubConvexQueries(page);
  });

  test("clicking Graph tab updates URL to ?view=graph", async ({ page }) => {
    await page.goto("/profile");

    const graphTab = page.getByRole("tab", { name: /Graph view/i });
    await graphTab.click();

    await expect(page).toHaveURL(/[?&]view=graph/);
    await expect(graphTab).toHaveAttribute("aria-selected", "true");
  });

  test("?view=graph mounts a canvas element for the force graph", async ({
    page,
  }) => {
    await page.goto("/profile?view=graph");

    // The Graph tab should be active.
    await expect(
      page.getByRole("tab", { name: /Graph view/i }),
    ).toHaveAttribute("aria-selected", "true");

    // react-force-graph-2d renders a <canvas> element inside the container.
    // We give it up to 10 s because the dynamic import for the graph engine
    // may take a moment to load.
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("toggling back to data view restores ?view=data URL and shows sections", async ({
    page,
  }) => {
    await page.goto("/profile?view=graph");

    const dataTab = page.getByRole("tab", { name: /Data view/i });
    await dataTab.click();

    await expect(page).toHaveURL(/[?&]view=data/);
    await expect(dataTab).toHaveAttribute("aria-selected", "true");

    // The DataView subtree is already mounted (display:none toggling) so
    // the Identity section header should be immediately visible.
    await expect(page.getByText("01 · Identity")).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: unauthenticated redirect
// ---------------------------------------------------------------------------

test.describe("Profile page: auth guard", () => {
  test("redirects unauthenticated users to /sign-in", async ({ page }) => {
    // Do not stub the auth session — the server will see no session cookie
    // and redirect. The GET /api/auth/get-session returns 401 by default.
    await page.route("**/api/auth/get-session", (route) => {
      route.fulfill({ status: 401, body: JSON.stringify({ error: "unauthorized" }) });
    });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 6_000 });
  });
});
