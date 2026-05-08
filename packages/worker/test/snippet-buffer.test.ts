import { describe, expect, it } from "vitest";
import { SnippetBuffer } from "../src/domain/snippet-buffer.js";

describe("SnippetBuffer", () => {
  it("starts empty", () => {
    const b = new SnippetBuffer();
    expect(b.size()).toBe(0);
    expect(b.drain()).toEqual([]);
  });

  it("preserves arrival order on drain", () => {
    const b = new SnippetBuffer();
    b.push({ snippetId: "s1", content: "first" });
    b.push({ snippetId: "s2", content: "second" });
    b.push({ snippetId: "s3", content: "third" });
    expect(b.drain()).toEqual([
      { snippetId: "s1", content: "first" },
      { snippetId: "s2", content: "second" },
      { snippetId: "s3", content: "third" },
    ]);
  });

  it("drain empties the buffer", () => {
    const b = new SnippetBuffer();
    b.push({ snippetId: "s1", content: "x" });
    b.drain();
    expect(b.size()).toBe(0);
    expect(b.drain()).toEqual([]);
  });
});
