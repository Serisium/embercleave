import type { SnippetPush } from "@serisium/embercleave-protocol";
import type { SnippetBuffer } from "../domain/snippet-buffer.js";

export interface BufferSnippetDeps {
  readonly buffer: SnippetBuffer;
}

/** Append a `snippet_push` to the buffer for injection on the next turn. */
export function bufferSnippet(deps: BufferSnippetDeps, snippet: SnippetPush): void {
  deps.buffer.push({ snippetId: snippet.snippetId, content: snippet.content });
}
