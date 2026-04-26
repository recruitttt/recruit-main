import assert from "node:assert/strict";

import {
  canStartSourceRun,
  isGithubConnected,
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
}

main();
