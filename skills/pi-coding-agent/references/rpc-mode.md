# Pi `--mode rpc`

Source: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md`. Activate with `pi --mode rpc`. Used by embercleave for arch.md:519 option (b): "manager runs in `--mode rpc` and a thin HTTP wrapper exposes it" — the wrapper is a separate process that bridges HTTP to pi's stdin/stdout.

## Framing

Strict LF-delimited JSONL. **Clients must split on `\n` only** (no CRLF). Each line is one complete JSON object. Both directions use the same framing.

## Request envelope

```json
{ "id": "req-1", "type": "command-name", "...": "...method-specific fields..." }
```

`id` is optional but recommended — pi includes the same `id` in the matching response so multiple in-flight requests can be correlated.

## Response envelope

```json
{ "type": "response", "command": "command-name", "success": true, "data": { } }
```

On error: `{ "type": "response", "command": "...", "success": false, "error": "..." }`.

## Methods (commands the client sends)

### Driving the agent

| `type` | Fields | Effect |
|---|---|---|
| `prompt` | `text`, `images?` | Send a user prompt (starts a turn if idle, queues otherwise). |
| `steer` | `text` | Queue a message to deliver mid-stream, between tool calls. Mirrors the `steer` bus message arch.md:163. |
| `follow_up` | `text` | Queue for after the current agent run ends. |
| `abort` | — | Abort the current agent operation. |

### Inspection

| `type` | Returns |
|---|---|
| `get_state` | model, thinking level, streaming status, queue modes |
| `get_messages` | full conversation messages array |
| `get_last_assistant_text` | final assistant response text only |

### Model

| `type` | Fields |
|---|---|
| `set_model` | `provider`, `modelId` |
| `cycle_model` | — |
| `get_available_models` | — |

### Bash

| `type` | Fields |
|---|---|
| `bash` | `command` — executes and adds output to conversation context |
| `abort_bash` | — |

### Sessions

| `type` | Fields |
|---|---|
| `new_session` | — |
| `switch_session` | session path |
| `fork` | from a specific user-message id |
| `clone` | duplicate current branch |

## Event stream (pi → client)

Stdout receives both `response` envelopes (in reply to commands) **and** unsolicited event lines:

```json
{"type": "agent_start"}
{"type": "turn_start", "turnIndex": 0}
{"type": "message_update", "message": {...}, "assistantMessageEvent": {...}}
{"type": "tool_execution_start", "toolCallId": "...", "toolName": "bash", "args": {...}}
{"type": "tool_execution_end", "toolCallId": "...", "result": {...}}
{"type": "turn_end", "turnIndex": 0}
{"type": "agent_end", "messages": [...]}
```

Other event types: `message_start`, `message_end`, `tool_execution_update`, `queue_update`, `compaction_start`, `compaction_end`.

These mirror the lifecycle events that extensions see via `pi.on(...)` (see `extension-api.md`). The bus wire format on `/run/pi-swarm/bus.sock` reuses the same shape for `agent_status` so the manager and workers don't need separate translation layers.

## Extension UI sub-protocol

When an extension calls `ctx.ui.select` / `confirm` / `input` / `editor` (which expect a response) or `notify` / `setStatus` / `setWidget` / `setTitle` / `set_editor_text` (fire-and-forget), pi emits:

```json
{ "type": "extension_ui_request", "id": "uuid-1", "method": "select",
  "title": "...", "options": [...], "timeout": 10000 }
```

The client must respond on stdin:

```json
{ "type": "extension_ui_response", "id": "uuid-1", "value": "selected" }
```

The HTTP wrapper for the manager will need to surface these to the human (or auto-decline) — they cannot be ignored without timeouts triggering. For the manager's worker-status widget specifically, `setWidget` is fire-and-forget, so the wrapper's job is just to broadcast the widget state to connected HTTP clients (e.g. as SSE).

## Inferred vs documented

The method list above is documented in `docs/rpc.md`. What is **inferred**:

- That the embercleave HTTP wrapper can be a thin process that pipes raw HTTP request bodies to `prompt` / `steer` / `abort` requests on the pi RPC stream. This is the natural design but pi does not ship such a wrapper — it must be written.
- That `extension_ui_request` events flowing out of the manager (because `pi-swarm-manager` calls `ctx.ui.setWidget`) must be re-broadcast by the HTTP wrapper to give humans visibility into worker status. The pi RPC docs cover the protocol but say nothing about this UI-bridging design.
