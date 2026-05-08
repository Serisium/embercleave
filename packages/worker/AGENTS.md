# @serisium/embercleave-worker

Worker-side pi extension. Installed in **every** pi instance, including the
manager (which loads both worker and manager extensions). Responsible for
opening the bus client, identifying via `worker_hello`, and forwarding
status. See `arch.md` §4.2.

## Public API (`src/index.ts`)

`export default` — the pi extension factory. Pi loads it on extension
discovery; the entry wires adapters into use-cases (`framework/
extension-entry.ts`).

## Layout

```
src/
  domain/
    reconnect-schedule.ts          # 250/500/1000/2000 ms cap (arch.md:155)
    snippet-buffer.ts              # step 7
  use-cases/
    connect-to-bus.use-case.ts     # step 5
    forward-agent-status.use-case.ts # step 5
    flush-snippets-on-turn.use-case.ts # step 7
    handle-steer.use-case.ts       # step 7
    publish-to-topic.use-case.ts   # step 6
    subscribe-to-topic.use-case.ts # step 6
    request-handoff.use-case.ts    # step 7
  adapters/
    bus-client.{port,adapter}.ts   # UDS connect, JSONL framing, reconnect loop
    pi-host.{port,adapter}.ts      # pi events; only file importing @mariozechner/pi-coding-agent
  framework/
    extension-entry.ts             # default-exported pi factory; DI wiring
test/
  reconnect-schedule.test.ts
  forward-agent-status.test.ts
  connect-to-bus.test.ts
```

## Where new functionality goes

- New worker LLM tool (e.g. `swarm_publish`) → new
  `<name>.use-case.ts` + extend `PiHostPort` with `registerTool`
  (step 6 will).
- New incoming wire kind handler → new `<name>.use-case.ts`. The framework
  parses the JSONL line through `BusMessageSchema` (step 6) and dispatches
  to the right use-case.
- New domain rule (e.g. token bucket) → `domain/<name>.ts`. Pure value
  objects or pure functions; no `node:net`, no pi.

## Conventions

- The dependency rule is `adapters → use-cases → domain`. `domain/`
  imports nothing outside `domain/` and `@serisium/embercleave-protocol`.
- `pi-host.adapter.ts` is the **only** file that imports
  `@mariozechner/pi-coding-agent`. Any other file that touches it is a
  bug; redirect through `PiHostPort`.
- The bus protocol is the source of truth for message shapes; consume
  via `@serisium/embercleave-protocol`. Do not redeclare schemas.
- `EMBERCLEAVE_AGENT_ID` is the env var the Quadlet sets per instance
  (arch.md:287). Falls back to `embercleave-${pid}` when unset.
- `EMBERCLEAVE_SOCKET` overrides the bus socket path (default:
  `/run/embercleave/bus.sock`).

## Step 5 status

- `bus-client.adapter.ts` — UDS connect with reconnect loop driven by
  `reconnect-schedule.ts`.
- `connect-to-bus.use-case.ts` — sends `worker_hello` on every successful
  connect (and re-connect).
- `forward-agent-status.use-case.ts` — maps pi `agent_start`/`agent_end`/
  `tool_execution_start` to wire `agent_status` (arch.md:158-162).

Manual smoke test: from a manager pi terminal (running `@serisium/embercleave-manager`
extension that has bound the bus), spawn a second pi with `EMBERCLEAVE_AGENT_ID=alice
pi --extension <worker-dist>`. The manager logs `bus connection accepted: c-1`
followed by the worker's `worker_hello` line.
