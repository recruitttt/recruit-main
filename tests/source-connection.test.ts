import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  canStartSourceRun,
  getSourceConnectionStatus,
  isLinkedinProfileUrl,
  isGithubConnected,
  normalizeLinkedinProfileUrl,
  shouldAutoStartGithubIntake,
} from "../lib/intake/shared/source-state";
import { createSseWriter } from "../lib/intake/shared/sse";

function main() {
  assert.equal(
    isGithubConnected({
      github: { linked: false, hasAccessToken: false },
    }),
    false
  );
  assert.equal(
    isGithubConnected({
      github: { linked: true, hasAccessToken: false },
    }),
    false
  );
  assert.equal(
    isGithubConnected({
      github: { linked: true, hasAccessToken: true },
    }),
    true
  );

  assert.equal(
    shouldAutoStartGithubIntake({
      connected: true,
      run: null,
    }),
    true
  );
  assert.equal(
    shouldAutoStartGithubIntake({
      connected: true,
      run: { status: "completed" },
    }),
    false
  );
  assert.equal(
    shouldAutoStartGithubIntake({
      connected: true,
      run: { status: "completed" },
      hasImportedGithub: false,
    }),
    true
  );
  assert.equal(
    shouldAutoStartGithubIntake({
      connected: true,
      run: { status: "completed" },
      hasImportedGithub: true,
    }),
    false
  );
  assert.equal(
    shouldAutoStartGithubIntake({
      connected: true,
      run: { status: "running" },
      hasImportedGithub: false,
    }),
    false
  );
  assert.equal(
    shouldAutoStartGithubIntake({
      connected: false,
      run: null,
    }),
    false
  );

  assert.equal(canStartSourceRun(null), true);
  assert.equal(canStartSourceRun({ status: "failed" }), true);
  assert.equal(canStartSourceRun({ status: "completed" }), true);
  assert.equal(canStartSourceRun({ status: "running" }), false);
  assert.equal(getSourceConnectionStatus({ loading: true }), "loading");
  assert.equal(
    getSourceConnectionStatus({ connected: true, run: { status: "running" } }),
    "processing"
  );
  assert.equal(
    getSourceConnectionStatus({ connected: true, run: { status: "completed" } }),
    "done"
  );
  assert.equal(
    getSourceConnectionStatus({ connected: true, run: null }),
    "connected"
  );
  assert.equal(getSourceConnectionStatus({ saved: true, run: null }), "saved");
  assert.equal(
    getSourceConnectionStatus({ saved: true, run: { status: "failed" } }),
    "failed"
  );
  assert.equal(
    normalizeLinkedinProfileUrl("linkedin.com/in/test-person"),
    "https://linkedin.com/in/test-person"
  );
  assert.equal(isLinkedinProfileUrl("linkedin.com/in/test-person"), true);
  assert.equal(isLinkedinProfileUrl("https://example.com/in/test-person"), false);

  const chunks: string[] = [];
  let closed = false;
  const writer = createSseWriter({
    enqueue(chunk) {
      chunks.push(new TextDecoder().decode(chunk));
    },
    close() {
      closed = true;
    },
  });
  assert.equal(writer.send({ stage: "starting" }), true);
  writer.close();
  assert.equal(closed, true);
  assert.equal(writer.send({ stage: "late" }), false);
  writer.close();
  assert.deepEqual(chunks, ['data: {"stage":"starting"}\n\n']);

  const alreadyClosed = createSseWriter({
    enqueue() {
      throw new TypeError("Invalid state: Controller is already closed");
    },
    close() {
      throw new TypeError("Invalid state: Controller is already closed");
    },
  });
  assert.equal(alreadyClosed.send({ stage: "late" }), false);
  assert.doesNotThrow(() => alreadyClosed.close());

  const onboardingPage = readFileSync(
    new URL("../app/onboarding/page.tsx", import.meta.url),
    "utf8"
  );
  const onboardingClient = readFileSync(
    new URL("../app/onboarding/_client.tsx", import.meta.url),
    "utf8"
  );
  const onboardingConnectStep = readFileSync(
    new URL("../app/onboarding/steps/connect-step.tsx", import.meta.url),
    "utf8"
  );
  const onboardingSource = [
    onboardingPage,
    onboardingClient,
    onboardingConnectStep,
  ].join("\n");
  assert.match(onboardingPage, /<OnboardingClient \/>/);
  assert.match(onboardingConnectStep, /title="LinkedIn"/);
  assert.match(onboardingConnectStep, /placeholder="linkedin\.com\/in\/yourhandle"/);
  assert.equal(onboardingSource.includes("GitHub already connected"), false);
  assert.equal(onboardingSource.includes("auto-skip Connect"), false);
  assert.match(
    onboardingConnectStep,
    /Saved &mdash; processing in the background\./
  );
  assert.equal(onboardingSource.includes("CloudBrowserView"), false);
  assert.equal(onboardingSource.includes("liveViewUrl"), false);
  assert.equal(onboardingSource.includes("onLiveView"), false);

  const profilePageUrl = new URL("../app/profile/page.tsx", import.meta.url);
  const gatedProfilePageUrl = new URL(
    "../app/(app)/profile/page.tsx",
    import.meta.url
  );
  assert.equal(existsSync(profilePageUrl), true);
  assert.equal(existsSync(gatedProfilePageUrl), false);
  const profilePage = readFileSync(profilePageUrl, "utf8");
  assert.match(profilePage, /<Topnav \/>/);
  assert.match(profilePage, /not hidden by the onboarding cookie/);

  const readyRoom = readFileSync(
    new URL("../app/(app)/ready/_client.tsx", import.meta.url),
    "utf8"
  );
  assert.match(readyRoom, /handleConfigureSource/);
  assert.match(readyRoom, /handleDisconnectSource/);
  assert.match(readyRoom, /api\.sourceConnections\.disconnectSource/);

  const readyStatus = readFileSync(
    new URL("../components/ready/intake-status.tsx", import.meta.url),
    "utf8"
  );
  assert.match(readyStatus, /Configure/);
  assert.match(readyStatus, /Disconnect/);

  const githubAdapter = readFileSync(
    new URL("../lib/intake/github/adapter.ts", import.meta.url),
    "utf8"
  );
  const mapperIndex = githubAdapter.indexOf('stage: "mapper"');
  const reportIndex = githubAdapter.indexOf("runReport({");
  assert.ok(mapperIndex > -1, "GitHub adapter yields a mapper patch");
  assert.ok(reportIndex > -1, "GitHub adapter still attempts repo summaries");
  assert.ok(
    mapperIndex < reportIndex,
    "GitHub profile patch is emitted before optional AI repo summaries"
  );
  assert.match(githubAdapter, /GitHub repo summaries skipped/);

  const intakeActions = readFileSync(
    new URL("../convex/intakeActions.ts", import.meta.url),
    "utf8"
  );
  assert.match(intakeActions, /hasGitHubSnapshot/);

  const authModule = readFileSync(
    new URL("../convex/auth.ts", import.meta.url),
    "utf8"
  );
  assert.match(authModule, /disconnectGithub/);
  assert.match(authModule, /findGithubAccounts/);
  assert.match(authModule, /components\.betterAuth\.adapter as any\)\.deleteMany/);

  const sourceConnections = readFileSync(
    new URL("../convex/sourceConnections.ts", import.meta.url),
    "utf8"
  );
  assert.match(sourceConnections, /deleteMany/);

  const authGithub = readFileSync(
    new URL("../lib/auth-github.ts", import.meta.url),
    "utf8"
  );
  assert.match(authGithub, /findMany/);
  assert.match(authGithub, /find\(\s*\(row\)/);
}

main();
