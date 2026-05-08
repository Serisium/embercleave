import type { SnippetPush } from "@serisium/embercleave-protocol";

/**
 * Pure FIFO buffer of pending snippets. Drained on the next
 * `before_agent_start` event (arch.md:163-166).
 */
export interface BufferedSnippet {
  readonly snippetId: string;
  readonly content: string;
}

export class SnippetBuffer {
  private readonly queue: BufferedSnippet[] = [];

  push(snippet: Pick<SnippetPush, "snippetId" | "content">): void {
    this.queue.push({ snippetId: snippet.snippetId, content: snippet.content });
  }

  /** Returns and removes all currently buffered snippets, in arrival order. */
  drain(): readonly BufferedSnippet[] {
    const out = [...this.queue];
    this.queue.length = 0;
    return out;
  }

  size(): number {
    return this.queue.length;
  }
}
