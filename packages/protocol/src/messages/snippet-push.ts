import { type Static, Type } from "typebox";

/**
 * manager → worker. Push a context snippet that the worker buffers and
 * injects on the next `before_agent_start` event, wrapped in a
 * `<context-snippet>` tag (arch.md:163-166).
 */
export const SnippetPushSchema = Type.Object({
  kind: Type.Literal("snippet_push"),
  snippetId: Type.String(),
  content: Type.String(),
});

export type SnippetPush = Static<typeof SnippetPushSchema>;
