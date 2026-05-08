import { describe, expect, it } from "vitest";
import { SnippetBuffer } from "../src/domain/snippet-buffer.js";
import { flushSnippetsOnTurn } from "../src/use-cases/flush-snippets-on-turn.use-case.js";

describe("flushSnippetsOnTurn", () => {
  it("returns an empty result when the buffer is empty", () => {
    const buffer = new SnippetBuffer();
    const result = flushSnippetsOnTurn({ buffer }, { currentSystemPrompt: "base" });
    expect(result).toEqual({});
  });

  it("appends snippets to the system prompt wrapped in <context-snippet> tags", () => {
    const buffer = new SnippetBuffer();
    buffer.push({ snippetId: "s1", content: "remember the cwd" });
    buffer.push({ snippetId: "s2", content: "also: prefer pnpm" });
    const result = flushSnippetsOnTurn({ buffer }, { currentSystemPrompt: "base" });
    expect(result.augmentedSystemPrompt).toBe(
      'base\n\n<context-snippet id="s1">\nremember the cwd\n</context-snippet>\n\n<context-snippet id="s2">\nalso: prefer pnpm\n</context-snippet>',
    );
  });

  it("drains the buffer so a second flush returns empty", () => {
    const buffer = new SnippetBuffer();
    buffer.push({ snippetId: "s1", content: "hello" });
    flushSnippetsOnTurn({ buffer }, { currentSystemPrompt: "base" });
    const result = flushSnippetsOnTurn({ buffer }, { currentSystemPrompt: "base" });
    expect(result).toEqual({});
  });

  it("preserves snippet arrival order", () => {
    const buffer = new SnippetBuffer();
    buffer.push({ snippetId: "first", content: "1" });
    buffer.push({ snippetId: "second", content: "2" });
    const result = flushSnippetsOnTurn({ buffer }, { currentSystemPrompt: "" });
    expect(result.augmentedSystemPrompt).toContain('id="first"');
    expect(result.augmentedSystemPrompt!.indexOf('id="first"')).toBeLessThan(
      result.augmentedSystemPrompt!.indexOf('id="second"'),
    );
  });
});
