# @serisium/embercleave-protocol

Wire protocol types and Typebox schemas for the embercleave bus.
**Types-only — no runtime behaviour beyond pure validators.**
See `arch.md` §4.1 and §5.

## Public API (`src/index.ts`)

- `PROTOCOL_VERSION`, `isMajorMatch(local, remote)` — major-version
  compatibility check used by the manager when accepting `worker_hello`
  (`arch.md:141-146`).
- `AGENT_ID_PATTERN`, `AgentIdSchema`, `isValidAgentId(value)` — the
  `^[a-z0-9-]+$` validator (`arch.md:229-232`).
- `BusMessageSchema`, `BusMessage` — discriminated union of every wire
  message; discriminator is `kind`.
- Per-kind schema and inferred type:
  - `WorkerHelloSchema` / `WorkerHello`
  - `AgentStatusSchema` / `AgentStatus` (plus `WorkerStatusSchema` /
    `WorkerStatus` for the status payload itself)
  - `SubscribeSchema` / `Subscribe`
  - `PublishSchema` / `Publish`
  - `TopicMessageSchema` / `TopicMessage`
  - `SnippetPushSchema` / `SnippetPush`
  - `SteerSchema` / `Steer`
  - `HandoffRequestSchema` / `HandoffRequest`

## Where new functionality goes

- New wire message kind → `src/messages/<kind>.ts` exporting the schema
  and the `Static<typeof Schema>` type, then add to the union in
  `src/bus-message.ts` and re-export from `src/index.ts`. Add a fixture
  to `test/round-trip.test.ts`.
- Pure cross-package validators → top of `src/`. If a validator grows
  domain logic, it belongs in the package that owns the domain.
- No adapters, no use-cases. This package has zero IO.

## Conventions

- Each `messages/<kind>.ts` exports both a schema (`<KindName>Schema`)
  and its inferred type (`<KindName>`) — exception to the one-symbol-
  per-file rule, since they're two views of the same wire shape.
- Imports use `.js` extensions (NodeNext ESM resolution).
- Tests in `test/` use `vitest`. Round-trip every schema variant through
  `Value.Encode` ↔ `Value.Decode`.
- Only runtime dep: `typebox`.

## Versioning

`PROTOCOL_VERSION` is a SemVer string. Bump the **major** when a wire
message adds a required field, removes a field, or changes a type. Bump
the **minor** when adding a new optional field or a new message kind.
Manager and worker must agree on the major version; mismatch closes the
connection on `worker_hello` (`arch.md:141-146`).
