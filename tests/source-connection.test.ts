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
  assert.match(onboardingPage, /label="LinkedIn URL"/);
  assert.equal(onboardingPage.includes("GitHub already connected"), false);
  assert.equal(onboardingPage.includes("auto-skip Connect"), false);
  assert.match(
    onboardingPage,
    /It's saved and I have processed it in the backend\./
  );
  assert.equal(onboardingPage.includes("CloudBrowserView"), false);
  assert.equal(onboardingPage.includes("liveViewUrl"), false);
  assert.equal(onboardingPage.includes("onLiveView"), false);

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
}

main();
