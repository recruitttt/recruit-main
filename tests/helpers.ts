import assert from "node:assert/strict";

export class MemoryStorage {
  private items = new Map<string, string>();

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  clear() {
    this.items.clear();
  }
}

export function installMemoryWindow() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage, setTimeout, clearTimeout },
    configurable: true,
  });
  return storage;
}

export function withEnv<T>(updates: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export async function withEnvAsync<T>(
  updates: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export function jsonRequest(body: unknown, url = "http://test.local/api") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function badJsonRequest(url = "http://test.local/api") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
}

export async function assertJsonResponse(
  response: Response,
  status: number,
  expected: Record<string, unknown>
) {
  assert.equal(response.status, status);
  const json = (await response.json()) as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(json[key], value);
  }
  return json;
}

export function installFetchStub(
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
}
