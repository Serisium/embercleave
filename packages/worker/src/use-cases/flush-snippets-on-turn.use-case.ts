import type { SnippetBuffer } from "../domain/snippet-buffer.js";

export interface FlushSnippetsDeps {
  readonly buffer: SnippetBuffer;
}

export interface FlushSnippetsInput {
  readonly currentSystemPrompt: string;
}

export interface FlushSnippetsResult {
  readonly augmentedSystemPrompt?: string;
}

/**
 * Drain pending snippets and embed them in the turn's system prompt,
 * each wrapped in a `<context-snippet>` tag. Called from
 * `before_agent_start`. arch.md:163-166.
 *
 * Returns an empty result when the buffer is empty so the caller can
 * skip the result chain on pi.
 */
export function flushSnippetsOnTurn(
  deps: FlushSnippetsDeps,
  input: FlushSnippetsInput,
): FlushSnippetsResult {
  const snippets = deps.buffer.drain();
  if (snippets.length === 0) return {};
  const block = snippets
    .map((s) => `<context-snippet id="${s.snippetId}">\n${s.content}\n</context-snippet>`)
    .join("\n\n");
  return { augmentedSystemPrompt: `${input.currentSystemPrompt}\n\n${block}` };
}
