import { describe, expect, it } from "vitest";
import { RECONNECT_DELAYS_MS, reconnectDelayMs } from "../src/domain/reconnect-schedule.js";

describe("reconnectDelayMs", () => {
  it("walks the schedule for the first attempts", () => {
    expect(reconnectDelayMs(0)).toBe(250);
    expect(reconnectDelayMs(1)).toBe(500);
    expect(reconnectDelayMs(2)).toBe(1000);
    expect(reconnectDelayMs(3)).toBe(2000);
  });

  it("caps at the last value for higher attempts", () => {
    expect(reconnectDelayMs(4)).toBe(2000);
    expect(reconnectDelayMs(99)).toBe(2000);
  });

  it("clamps negative attempts to the first value", () => {
    expect(reconnectDelayMs(-1)).toBe(250);
  });

  it("uses the documented schedule from arch.md:154-155", () => {
    expect([...RECONNECT_DELAYS_MS]).toEqual([250, 500, 1000, 2000]);
  });
});
