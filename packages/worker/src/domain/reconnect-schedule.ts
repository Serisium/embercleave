/** Backoff schedule for bus client reconnects. arch.md:154-155. */
export const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000] as const;

/**
 * Returns the delay (ms) before the `attempt`-th reconnect attempt.
 * `attempt` is 0-indexed: attempt 0 means the first reconnect after a
 * disconnect. After the last entry, the cap (2000 ms) repeats.
 */
export function reconnectDelayMs(attempt: number): number {
  const safe = Math.max(0, attempt);
  const index = Math.min(safe, RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[index] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1] ?? 2000;
}
