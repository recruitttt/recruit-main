export interface RateLimitState {
  remaining: number;
  reset: number;
}

export function readRateLimit(headers: Record<string, unknown>): RateLimitState | null {
  const remaining = Number(headers["x-ratelimit-remaining"]);
  const reset = Number(headers["x-ratelimit-reset"]);
  if (Number.isFinite(remaining) && Number.isFinite(reset)) {
    return { remaining, reset };
  }
  return null;
}

export async function waitForReset(state: RateLimitState | null, threshold = 50): Promise<void> {
  if (!state || state.remaining > threshold) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const sleepSec = Math.max(0, state.reset - nowSec) + 1;
  if (sleepSec <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, sleepSec * 1000));
}
