# @serisium/embercleave-manager

Manager-side pi extension. Binds the JSONL bus on `session_start`,
maintains the worker registry, routes topic publish/subscribe, surfaces
`handoff_request` to the manager's own LLM, renders a status widget, and
registers manager-callable tools. **Manager pi only — workers must not
load this package.** See `arch.md` §4.3.

## Public API (`src/index.ts`)

`export default` — the pi extension factory. Pi loads it on extension
discovery; the entry wires adapters into use-cases (`framework/
extension-entry.ts`).

## Layout

```
src/
  domain/                 # pure: WorkerRecord, WorkerRegistry, TopicRouter, StatusSnapshot (lands in steps 6, 9)
  use-cases/              # one file per behaviour; expressed against ports
    bind-bus.use-case.ts  # step 4
  adapters/
    bus-server.{port,adapter}.ts   # UDS server, JSONL line framing
    pi-host.{port,adapter}.ts      # pi events + tool registration; only file importing @mariozechner/pi-coding-agent
    systemd-units.*       # step 9
    journald.*            # step 9
    podman-rest.*         # step 9
  framework/
    extension-entry.ts    # default-exported pi factory; DI wiring
test/
  bind-bus.test.ts        # use-case test with fake adapter
```

## Where new functionality goes

- New manager LLM tool → `use-cases/<name>.use-case.ts` + `framework/
  extension-entry.ts` registers it via `piHost.registerTool({...})`.
- New external integration (a CLI to shell out to, an HTTP API, …) →
  new `<thing>.port.ts` and `<thing>.adapter.ts` under `adapters/`.
  Inject in `framework/extension-entry.ts`.
- New domain concept (e.g. `LogTail`) → `domain/<name>.ts`. Pure value
  objects or pure functions only. No `node:net`, no pi, no `process`.

## Conventions

- The dependency rule is `adapters → use-cases → domain`. `domain/`
  imports nothing outside `domain/` and `@serisium/embercleave-protocol`.
- `pi-host.adapter.ts` is the **only** file that imports
  `@mariozechner/pi-coding-agent`. Any other file that touches it is a
  bug; redirect through `PiHostPort`.
- The bus protocol is the source of truth for message shapes; consume
  via `@serisium/embercleave-protocol`. Do not redeclare schemas here.
- Tests in `test/` use `vitest`. Use-case tests stub adapters via
  `*.port.ts` types.

## Step 4 status

- `bind-bus.use-case.ts` — bind UDS at `EMBERCLEAVE_SOCKET` (default
  `/run/embercleave/bus.sock`).
- `bus-server.adapter.ts` — UDS server with line-buffered JSONL receive,
  refuses to bind on a live socket, removes stale socket files.
- `swarm_noop` tool — single no-op tool to confirm the LLM tool surface.

Manual smoke test: `pi --extension <manager-dist>` then `nc -U
/run/embercleave/bus.sock` and type a JSONL line; the manager logs
`bus rx c-1: <line>` to stderr.
