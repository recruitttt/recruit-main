import assert from "node:assert/strict";

import {
  buildBackoffDelayMs,
  buildMimeMessage,
  classifyGmailError,
  detectInboundThreadReply,
} from "../lib/gmail-followups";

function decodeGmailRaw(raw: string) {
  const padded = raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );
}

assert.equal(
  buildBackoffDelayMs(0, { baseDelayMs: 1_000, maxDelayMs: 60_000, jitterRatio: 0 }),
  1_000
);
assert.equal(
  buildBackoffDelayMs(3, { baseDelayMs: 1_000, maxDelayMs: 60_000, jitterRatio: 0 }),
  8_000
);
assert.equal(
  buildBackoffDelayMs(10, { baseDelayMs: 1_000, maxDelayMs: 60_000, jitterRatio: 0 }),
  60_000
);
assert.equal(
  buildBackoffDelayMs(1, {
    baseDelayMs: 1_000,
    maxDelayMs: 60_000,
    retryAfterMs: 45_000,
    jitterRatio: 0,
  }),
  45_000
);

const rateLimited = classifyGmailError({
  code: 403,
  errors: [{ reason: "rateLimitExceeded" }],
});
assert.equal(rateLimited.kind, "rate_limited");
assert.equal(rateLimited.retryable, true);

const authFailure = classifyGmailError({ status: 401, message: "Invalid Credentials" });
assert.equal(authFailure.kind, "auth");
assert.equal(authFailure.retryable, false);

const backendFailure = classifyGmailError({
  status: 503,
  headers: { "retry-after": "120" },
});
assert.equal(backendFailure.kind, "transient");
assert.equal(backendFailure.retryable, true);
assert.equal(backendFailure.retryAfterMs, 120_000);

const notFound = classifyGmailError({ code: 404, message: "Requested entity was not found" });
assert.equal(notFound.kind, "not_found");
assert.equal(notFound.retryable, false);

const rawMime = buildMimeMessage({
  from: "Mo Hoshir <mo@example.com>",
  to: "recruiter@example.com",
  subject: "Following up on Product Engineer",
  text: "Hi,\n\nChecking in on my application.\n\nThanks,\nMo",
  inReplyTo: "<application-thread@example.com>",
  references: ["<application-thread@example.com>"],
});

assert.doesNotMatch(rawMime, /[+/=]/);

const mime = decodeGmailRaw(rawMime);
assert.match(mime, /^From: Mo Hoshir <mo@example\.com>/m);
assert.match(mime, /^To: recruiter@example\.com/m);
assert.match(mime, /^Subject: Following up on Product Engineer/m);
assert.match(mime, /^MIME-Version: 1\.0/m);
assert.match(mime, /^Content-Type: text\/plain; charset=UTF-8/m);
assert.match(mime, /^In-Reply-To: <application-thread@example\.com>/m);
assert.match(mime, /^References: <application-thread@example\.com>/m);
assert.match(mime, /\r?\n\r?\nHi,\r?\n\r?\nChecking in on my application\./);

const inboundReply = detectInboundThreadReply({
  selfEmail: "mo@example.com",
  sentAt: "2026-04-25T10:00:00.000Z",
  sentMessageId: "<followup-1@example.com>",
  messages: [
    {
      id: "earlier-inbound",
      internalDate: String(Date.parse("2026-04-25T09:00:00.000Z")),
      snippet: "Earlier note",
      payload: {
        headers: [
          { name: "From", value: "Recruiter <recruiter@example.com>" },
          { name: "Message-ID", value: "<earlier@example.com>" },
        ],
      },
    },
    {
      id: "sent-followup",
      internalDate: String(Date.parse("2026-04-25T10:00:00.000Z")),
      labelIds: ["SENT"],
      snippet: "Checking in",
      payload: {
        headers: [
          { name: "From", value: "Mo Hoshir <mo@example.com>" },
          { name: "Message-ID", value: "<followup-1@example.com>" },
        ],
      },
    },
    {
      id: "recruiter-reply",
      internalDate: String(Date.parse("2026-04-25T10:05:00.000Z")),
      snippet: "Thanks for following up.",
      payload: {
        headers: [
          { name: "From", value: "Recruiter <recruiter@example.com>" },
          { name: "Message-ID", value: "<reply@example.com>" },
          { name: "In-Reply-To", value: "<followup-1@example.com>" },
          { name: "References", value: "<application-thread@example.com> <followup-1@example.com>" },
        ],
      },
    },
  ],
});

assert.deepEqual(inboundReply, {
  gmailMessageId: "recruiter-reply",
  messageId: "<reply@example.com>",
  from: "Recruiter <recruiter@example.com>",
  receivedAt: "2026-04-25T10:05:00.000Z",
  snippet: "Thanks for following up.",
});

const noInboundReply = detectInboundThreadReply({
  selfEmail: "mo@example.com",
  sentAt: "2026-04-25T10:00:00.000Z",
  sentMessageId: "<followup-1@example.com>",
  messages: [
    {
      id: "self-followup",
      internalDate: String(Date.parse("2026-04-25T10:05:00.000Z")),
      labelIds: ["SENT"],
      payload: {
        headers: [
          { name: "From", value: "Mo Hoshir <mo@example.com>" },
          { name: "In-Reply-To", value: "<followup-1@example.com>" },
        ],
      },
    },
  ],
});

assert.equal(noInboundReply, undefined);

console.log("Gmail follow-up helper tests passed");
