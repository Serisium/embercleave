# Pi extension API reference

Source: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md`. Package: `@mariozechner/pi-coding-agent` (npm: `https://www.npmjs.com/package/@mariozechner/pi-coding-agent`). Verify exact signatures against the version pinned in `package.json` — pi is a fast-moving small project and minor versions have added events.

## Extension shape

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx: ExtensionContext) => { /* ... */ });
  // ...
}
```

The default export is a factory invoked once per pi process, with the `ExtensionAPI` instance. All registration and event subscription happens synchronously inside this factory.

## Lifecycle events (chronological within a session)

Subscribe with `pi.on(eventName, handler)`. Handlers receive `(event, ctx)` and may return a partial-mutation object for events that support it.

| Event | Payload | Return shape | Notes |
|---|---|---|---|
| `session_start` | `{ reason: "startup" \| "reload" \| "new" \| "resume" \| "fork", previousSessionFile? }` | — | Fires once per session. Use for bus connect (worker) / bind (manager). arch.md:154, arch.md:182 |
| `resources_discover` | `{ cwd, reason: "startup" \| "reload" }` | `{ skillPaths?, promptPaths?, themePaths? }` | Lets extensions register additional skill/prompt/theme search paths. |
| `session_before_switch` | `{ reason: "new" \| "resume", targetSessionFile? }` | `{ cancel?: boolean }` | Return `{ cancel: true }` to veto a switch. |
| `before_agent_start` | `{ prompt, images?, systemPrompt, systemPromptOptions, ... }` | `{ message?, systemPrompt? }` | **This is the hook arch.md calls `before_turn` (arch.md:161).** Mutate `message` to inject `<context-snippet>` wrappers. |
| `agent_start` | — | — | Notification only. |
| `turn_start` | `{ turnIndex, timestamp }` | — | One per LLM round-trip inside a single agent run. Too granular for snippet injection. |
| `context` | `{ messages }` | `{ messages? }` | Last chance to rewrite the messages array sent to the model. |
| `message_start` / `message_update` / `message_end` | message lifecycle | — | Fine-grained streaming events. |
| `tool_execution_start` / `update` / `end` | tool execution phases | — | Use these to forward `tool:<name>` status to the bus. arch.md:159 |
| `tool_call` | `{ toolName, toolCallId, input }` | `{ block?, reason? }` | Return `{ block: true, reason }` to refuse a tool call. |
| `tool_result` | `{ toolName, toolCallId, input, content, details, isError }` | partial patches | Mutate the result before it goes back to the model. |
| `turn_end` | `{ turnIndex, message, toolResults }` | — | |
| `agent_end` | `{ messages }` | — | Whole prompt-to-final-answer agent run is done. Worker emits `idle` on the bus here. |
| `model_select` | `{ model, previousModel?, source }` | — | |
| `thinking_level_select` | `{ level, previousLevel }` | — | |
| `session_before_compact` | `{ preparation, branchEntries, ... }` | `{ cancel? } \| { compaction }` | |
| `session_compact` | — | Notification. |
| `session_shutdown` | `{ reason, targetSessionFile? }` | — | Close fds, drain bus. arch.md:170 |

**arch.md naming divergence:** arch.md says `before_turn` (arch.md:161); the documented event is `before_agent_start`. arch.md says forwarding `thinking` / `idle` / `tool:<name>` events (arch.md:159); these are derived statuses computed from `agent_start` / `agent_end` / `tool_execution_start` / `tool_execution_end` — pi does not emit a single `thinking` or `idle` event by name.

## `pi.registerTool` — the worker's swarm tools and the manager's swarm tools

```ts
pi.registerTool({
  name: string;            // e.g. "swarm_publish"
  label: string;           // pretty name for the TUI
  description: string;     // visible to the LLM
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: /* Typebox schema */;
  prepareArguments?(args): args;
  async execute(toolCallId, params, signal, onUpdate, ctx): Promise<{
    content: Array<{ type: "text"; text: string } | ...>;
    details: object;
    terminate?: boolean;
  }>;
  renderCall?(args, theme, context): Component;
  renderResult?(result, options, theme, context): Component;
  renderShell?: "self";
});
```

The arch.md tool list maps directly:

- Worker (arch.md:165-168): `swarm_publish`, `swarm_subscribe`, `swarm_request_handoff`.
- Manager (arch.md:194-199): `swarm_list`, `swarm_send_snippet`, `swarm_steer`, `swarm_logs`, `swarm_inspect`.
- Quadlet (arch.md:219-223): `swarm_spawn`, `swarm_stop`.

Use Typebox schemas for `parameters` — pi validates inputs against the schema before calling `execute`. The `signal` argument is an `AbortSignal` tied to user-initiated abort.

## Injecting prompts

```ts
pi.sendUserMessage(content | text, { deliverAs?: "steer" | "followUp" | "nextTurn" });
pi.sendMessage(message, { deliverAs?, triggerTurn? });
```

- `deliverAs: "steer"` — queue, deliver between tool calls during current streaming run.
- `deliverAs: "followUp"` — queue, deliver after current run ends.
- `deliverAs: "nextTurn"` — wait for idle, then start a new turn (this is what arch.md:189 wants for handoff surfacing).

## UI / widget API (`ctx.ui`)

For the manager's worker-status panel (arch.md:191):

```ts
ctx.ui.setWidget(id: string, lines | factory, { placement? });
ctx.ui.setStatus(id: string, status?: string);
ctx.ui.setWorkingMessage(message?);
ctx.ui.setFooter(factory | undefined);
ctx.ui.setTitle(title);
```

For interactive prompts (rare in swarm code; tools should be non-interactive):

```ts
ctx.ui.select(title, options): Promise<string | undefined>;
ctx.ui.confirm(title, message, { timeout?, signal? }): Promise<boolean>;
ctx.ui.input(label, placeholder): Promise<string | undefined>;
ctx.ui.editor(label, prefilled): Promise<string | undefined>;
ctx.ui.notify(message, "info" | "warning" | "error");
ctx.ui.custom<T>(callback, { overlay?, ... }): Promise<T>;
```

Theme access: `ctx.ui.theme` (color helpers `fg(color, text)`, `bold`, `italic`).

## Other registration APIs

```ts
pi.registerCommand(name, { description, handler, getArgumentCompletions? });
pi.registerShortcut(shortcut, { description, handler });
pi.registerFlag(name, { description, type: "boolean" | "string", default });
pi.registerProvider(name, providerConfig);
```

## Session and tool control

```ts
pi.appendEntry(customType: string, data?: any);   // persistent custom entry on the session JSONL tree
pi.setSessionName(name);
pi.getActiveTools(): ToolDefinition[];
pi.setActiveTools(names: string[]);
pi.setModel(model): Promise<boolean>;
pi.setThinkingLevel("off" | "minimal" | "low" | "medium" | "high" | "xhigh");
```

## `ExtensionContext` (`ctx`)

```ts
ctx.cwd: string;
ctx.hasUI: boolean;            // false in --print and --mode rpc when no TUI
ctx.signal?: AbortSignal;
ctx.modelRegistry;
ctx.model;

ctx.sessionManager.getEntries();
ctx.sessionManager.getBranch();
ctx.sessionManager.getLeafId();
ctx.sessionManager.getSessionFile();   // undefined when --no-session
ctx.sessionManager.getLabel(entryId);

ctx.isIdle(): boolean;
ctx.abort();
ctx.hasPendingMessages(): boolean;
ctx.shutdown();
ctx.getContextUsage(): { tokens } | undefined;
ctx.getSystemPrompt(): string;
ctx.compact({ customInstructions?, onComplete?, onError? });
```

Command-handler-only (the `ctx` passed to `registerCommand` handlers, not event handlers):

```ts
ctx.waitForIdle(): Promise<void>;
ctx.newSession(options?): Promise<{ cancelled }>;
ctx.fork(entryId, { position?, withSession? });
ctx.navigateTree(targetId, { summarize?, customInstructions?, ... });
ctx.switchSession(path, { withSession? });
ctx.reload();
```

## Imports for utility helpers

```ts
import {
  truncateHead, truncateTail, truncateLine, formatSize,
  DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES,
  highlightCode, getLanguageFromPath,
  withFileMutationQueue,
  createReadTool, createBashTool, createLocalBashOperations,
  isToolCallEventType, isBashToolResult,
  keyHint, keyText, rawKeyHint,
  CustomEditor,
} from "@mariozechner/pi-coding-agent";
```

## Inferred vs documented

Documented in `docs/extensions.md`: every event name and registration signature listed above.

Inferred from arch.md, **not** documented and worth verifying in the package source before relying on:

- That `before_agent_start` is the hook arch.md means by `before_turn`. The behaviour matches but the name is different.
- That `tool_execution_start` / `agent_start` / `agent_end` are the right events to derive arch.md's `thinking` / `idle` / `tool:<name>` agent-status messages (arch.md:159). Pi does not document a single composite "agent status" event.
- That `pi.appendEntry` works with `--no-session` (it likely no-ops, but the doc does not say). Worker state being in-memory only (arch.md:170) sidesteps this.
