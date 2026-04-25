export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

const DEFAULT_BASE_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_MAX_DELAY_MS = 24 * 60 * 60 * 1000;

export type BackoffOptions = {
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryAfterMs?: number;
  jitterRatio?: number;
};

export type GmailErrorKind =
  | "auth"
  | "rate_limited"
  | "transient"
  | "not_found"
  | "permanent"
  | "unknown";

export type GmailErrorClassification = {
  kind: GmailErrorKind;
  retryable: boolean;
  status?: number;
  code?: string;
  message?: string;
  retryAfterMs?: number;
};

export type MimeMessageInput = {
  from?: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
};

export type GmailThreadMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

export type InboundReplyDetectionInput = {
  selfEmail: string;
  sentAt?: string;
  sentMessageId?: string;
  messages: GmailThreadMessage[];
};

export type InboundReply = {
  gmailMessageId?: string;
  gmailThreadId?: string;
  messageId?: string;
  from?: string;
  subject?: string;
  receivedAt: string;
  snippet?: string;
};

export function buildBackoffDelayMs(
  attemptNumber: number,
  options: BackoffOptions = {}
) {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const exponent = Math.max(0, Math.floor(attemptNumber));
  const deterministicDelay = Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
  const retryAfterDelay = options.retryAfterMs
    ? Math.min(options.retryAfterMs, maxDelayMs)
    : 0;
  const delay = Math.max(deterministicDelay, retryAfterDelay);
  const jitterRatio = options.jitterRatio ?? 0;
  if (jitterRatio <= 0) return delay;
  const jitter = delay * jitterRatio * Math.random();
  return Math.min(Math.round(delay + jitter), maxDelayMs);
}

export function classifyGmailError(error: unknown): GmailErrorClassification {
  const input = error as {
    status?: number;
    code?: number | string;
    message?: string;
    headers?: Headers | Record<string, string | string[] | undefined>;
    errors?: Array<{ reason?: string; message?: string }>;
  };
  const status = numericStatus(input.status ?? input.code);
  const reason = input.errors?.[0]?.reason;
  const message = input.message ?? input.errors?.[0]?.message;
  const retryAfterMs = parseRetryAfterMs(getHeader(input.headers, "retry-after"));

  if (status === 401 || status === 403 && reason === "authError") {
    return { kind: "auth", retryable: false, status, code: reason, message };
  }
  if (
    status === 403 &&
    ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"].includes(
      reason ?? ""
    )
  ) {
    return { kind: "rate_limited", retryable: true, status, code: reason, message, retryAfterMs };
  }
  if ([429, 500, 502, 503, 504].includes(status ?? 0)) {
    return { kind: status === 429 ? "rate_limited" : "transient", retryable: true, status, code: reason, message, retryAfterMs };
  }
  if (status === 404) {
    return { kind: "not_found", retryable: false, status, code: reason, message };
  }
  if (message && /timeout|network|fetch failed|ECONNRESET/i.test(message)) {
    return { kind: "transient", retryable: true, status, code: reason, message };
  }
  if (status && status >= 400) {
    return { kind: "permanent", retryable: false, status, code: reason, message };
  }
  return { kind: "unknown", retryable: false, status, code: reason, message };
}

export function buildMimeMessage(input: MimeMessageInput) {
  const headers = [
    input.from ? ["From", sanitizeHeader(input.from)] : undefined,
    ["To", sanitizeHeader(input.to)],
    ["Subject", sanitizeHeader(input.subject)],
    ["MIME-Version", "1.0"],
    ["Content-Type", "text/plain; charset=UTF-8"],
    input.inReplyTo ? ["In-Reply-To", sanitizeHeader(input.inReplyTo)] : undefined,
    input.references?.length
      ? ["References", sanitizeHeader(input.references.join(" "))]
      : undefined,
  ].filter(Boolean) as Array<[string, string]>;
  const raw = [
    ...headers.map(([name, value]) => `${name}: ${value}`),
    "",
    input.text.replace(/\r?\n/g, "\r\n"),
  ].join("\r\n");
  return base64UrlEncode(raw);
}

export function detectInboundThreadReply({
  selfEmail,
  sentAt,
  sentMessageId,
  messages,
}: InboundReplyDetectionInput): InboundReply | undefined {
  const self = extractEmail(selfEmail).toLowerCase();
  const sentTime = sentAt ? Date.parse(sentAt) : 0;
  for (const message of [...messages].sort(compareInternalDate)) {
    const headers = headersMap(message);
    const from = headers.get("from");
    const fromEmail = extractEmail(from ?? "").toLowerCase();
    const receivedMs = Number(message.internalDate ?? 0);
    const messageId = headers.get("message-id");
    const inReplyTo = headers.get("in-reply-to") ?? "";
    const references = headers.get("references") ?? "";
    const isSelf = Boolean(fromEmail && fromEmail === self) || message.labelIds?.includes("SENT");
    if (isSelf) continue;
    if (sentTime && receivedMs <= sentTime) continue;
    if (sentMessageId && ![messageId, inReplyTo, references].some((value) => value?.includes(sentMessageId))) {
      continue;
    }
    return omitUndefined({
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      messageId,
      from,
      subject: headers.get("subject"),
      receivedAt: new Date(receivedMs || Date.now()).toISOString(),
      snippet: message.snippet,
    });
  }
  return undefined;
}

export function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function compareInternalDate(a: GmailThreadMessage, b: GmailThreadMessage) {
  return Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0);
}

function headersMap(message: GmailThreadMessage) {
  const map = new Map<string, string>();
  for (const header of message.payload?.headers ?? []) {
    map.set(header.name.toLowerCase(), header.value);
  }
  return map;
}

function extractEmail(value: string) {
  return value.match(/<([^>]+)>/)?.[1]?.trim() ?? value.trim();
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function numericStatus(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : undefined;
}

function parseRetryAfterMs(value?: string) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function getHeader(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  name: string
) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}
