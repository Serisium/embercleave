import { describe, expect, it } from "vitest";
import { serializeEnvFile } from "../src/domain/env-file.js";

describe("serializeEnvFile", () => {
  it("emits one KEY=value line per entry, terminated with a trailing newline", () => {
    expect(serializeEnvFile({ A: "1", B: "two" })).toBe("A=1\nB=two\n");
  });

  it("emits a single trailing newline for an empty map", () => {
    expect(serializeEnvFile({})).toBe("\n");
  });

  it("rejects names that aren't valid env-var identifiers", () => {
    expect(() => serializeEnvFile({ "1bad": "x" })).toThrow(/invalid env var name/);
    expect(() => serializeEnvFile({ "with-dash": "x" })).toThrow(/invalid env var name/);
  });

  it("rejects values containing newlines", () => {
    expect(() => serializeEnvFile({ K: "a\nb" })).toThrow(/contains a newline/);
    expect(() => serializeEnvFile({ K: "a\rb" })).toThrow(/contains a newline/);
  });
});
