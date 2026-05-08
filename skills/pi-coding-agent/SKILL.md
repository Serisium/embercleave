---
name: pi-coding-agent
description: Author or modify the four pi-swarm-* extensions for embercleave (pi-swarm-protocol, pi-swarm-worker, pi-swarm-manager, pi-swarm-quadlet). Use when registering pi tools (pi.registerTool), hooking lifecycle events (session_start, session_shutdown, before_agent_start / "before_turn", turn_start, turn_end, tool_call, tool_result, agent_end), calling pi.sendUserMessage / pi.sendMessage to inject prompts, rendering UI widgets via ctx.ui.setWidget for the manager's worker-status panel, working with pi's session model (--no-session vs persistent, --continue, --fork, .pi/agent/sessions/), driving pi externally via --mode rpc JSONL, or wiring the PI_SWARM_AGENT_ID env var into a worker. Pi is @mariozechner/pi-coding-agent — a minimal terminal coding harness whose entire extension surface is the ExtensionAPI passed to a default-exported function.
---

# Pi for the embercleave swarm

Pi (`@mariozechner/pi-coding-agent`, repo `badlogic/pi-mono`) is Layer 3: every worker is `pi --no-session` in a container; the manager is `pi` in its own Quadlet (arch.md:293, arch.md:519). The whole swarm is four pi extensions — no separate daemon.

## The four extensions

| Package | Installed in | Purpose |
|---|---|---|
| `pi-swarm-protocol` | every `pi` (transitively) | Types only: bus envelopes, Typebox schemas, protocol version. arch.md:140 |
| `pi-swarm-worker` | **every** `pi` (manager included) | Bus client. Connects to `/run/pi-swarm/bus.sock`, registers `swarm_publish` / `swarm_subscribe` / `swarm_request_handoff`, forwards lifecycle events as `agent_status`, injects snippets on next turn. arch.md:148-174 |
| `pi-swarm-manager` | manager `pi` only | Bus server. Binds the UDS, routes pub/sub, surfaces handoffs via `pi.sendUserMessage`, renders the worker-status widget, registers `swarm_list` / `swarm_send_snippet` / `swarm_steer` / `swarm_logs` / `swarm_inspect`. arch.md:176-199 |
| `pi-swarm-quadlet` | manager `pi` only | `systemctl --user start pi-worker@${agentId}.service`. Registers `swarm_spawn` / `swarm_stop`. arch.md:207-226 |

The manager pi runs **both** worker and manager extensions, so the manager is itself a swarm participant.

## Extension shape

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx: ExtensionContext) => { /* bind / connect */ });
  pi.on("before_agent_start", async (event, ctx) => { /* return { message } to inject snippets */ });
  pi.on("session_shutdown", async (event, ctx) => { /* close fds */ });

  pi.registerTool({
    name: "swarm_publish",
    label: "Swarm publish",
    description: "Publish to a topic on the swarm bus.",
    parameters: /* Typebox schema */,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: "ok" }], details: {} };
    },
  });
}
```

Full lifecycle event list, mutation/cancel return shapes, and every `ctx.ui.*` method are in `references/extension-api.md`.

### `before_turn` vs `before_agent_start` (arch.md naming divergence)

arch.md says `before_turn` (arch.md:161); the documented pi event is `before_agent_start` (fires once per user prompt, returns `{ message?, systemPrompt? }`). `turn_start` exists separately but fires per LLM round-trip inside an agent run — too granular for snippet flush. **Use `before_agent_start`** for arch.md's snippet injection.

## Injecting messages

```ts
pi.sendUserMessage(content | text, { deliverAs?: "steer" | "followUp" | "nextTurn" });
pi.sendMessage(message, { deliverAs?, triggerTurn? });
```

arch.md:163 / arch.md:189 use `sendUserMessage`. Manager surfacing a `handoff_request`: `deliverAs: "nextTurn"` (waits for idle, then starts a new turn). Worker receiving a `steer` mid-stream: `deliverAs: "steer"` (queues until next tool-call boundary).

## Worker status widget (manager only)

arch.md:191. Use `ctx.ui.setWidget(id, lines | factory, { placement? })`. Call once on `session_start`, then again on every bus event that changes the registry. Use a stable `id` so re-renders replace rather than stack.

## `--no-session` vs persistent (v1 trade-off)

Workers boot with `pi --no-session` (arch.md:293) — ephemeral, neither reads nor writes a session file. arch.md:506-510 and arch.md:463-466: restart loses LLM context. The natural upgrade once cleanup semantics are settled is `pi --session $PI_SWARM_AGENT_ID` — see `references/sessions.md` for the gotchas.

## `--mode rpc` for human steering (arch.md:519 option b)

JSONL over stdin/stdout, LF-delimited. Methods: `prompt`, `steer`, `follow_up`, `abort`, `get_state`, `get_messages`, `new_session`, etc. The HTTP wrapper that fronts this is **not** a pi feature — it must be written. Full envelope in `references/rpc-mode.md`.

## `PI_SWARM_AGENT_ID`

arch.md:287, arch.md:157. The Quadlet sets `Environment=PI_SWARM_AGENT_ID=%i` on `pi-worker@.container` (the systemd template instance name `%i` is the agent id). Worker reads `process.env.PI_SWARM_AGENT_ID` on `session_start`, falling back to `pi-${pid}`. Validation: `^[a-z0-9-]+$` (arch.md:225).

## References

- `references/extension-api.md` — lifecycle events, `pi.*` and `ctx.*` methods, `registerTool` shape.
- `references/cli-flags.md` — `pi` flags used by embercleave.
- `references/rpc-mode.md` — full JSONL protocol for `--mode rpc`.
- `references/sessions.md` — `~/.pi/agent/sessions/` layout, fork/continue, `--no-session`.
- Upstream: `https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs` is canonical. Verify against the version pinned in `package.json` if anything looks off.
