---
name: typebox
description: Reference for Typebox (`@sinclair/typebox`), the schema/validation library used by `pi-swarm-protocol` to define the JSONL bus wire format. Use when defining or modifying the `BusMessage` discriminated union and its variants (`worker_hello`, `agent_status`, `subscribe`, `publish`, `topic_message`, `snippet_push`, `steer`, `handoff_request`), adding a new message kind, deriving TypeScript types from schemas via `Static`, runtime-validating incoming JSONL on the bus receive loop, choosing between `Value.Check` / `Value.Decode` / `Value.Parse` / `TypeCompiler.Compile`, encoding the protocol-version constant or implementing the major-version mismatch check on `worker_hello`. Triggers: typebox, `@sinclair/typebox`, `Type.Object`, `Type.Union`, `Type.Literal`, `Static`, `Value.Check`, `Value.Errors`, `Value.Decode`, `Value.Parse`, `TypeCompiler`, BusMessage schema, pi-swarm-protocol, bus message validation, JSON Schema in TypeScript.
---

# Typebox for `pi-swarm-protocol`

## What Typebox is

Typebox (`@sinclair/typebox`, https://github.com/sinclairzx81/typebox, https://www.npmjs.com/package/@sinclair/typebox) builds JSON Schema documents and TS types from the same definition. A schema is a plain JS value (`Type.Object({...})`); the static TS type is recovered with `Static<typeof Schema>`. Validation runs through the `Value.*` namespace, or — for hot paths — an ahead-of-time compiler in `@sinclair/typebox/compiler`.

Two release lines: `0.x` LTS (current head ~0.34.x, ESM+CJS) and `1.x` (TypeScript 7+, ESM-only). embercleave is on LTS; everywhere this skill uses `Static<typeof T>` and `Value.*`, that is the LTS API.

## Role in embercleave

Per `arch.md` §4.1, `pi-swarm-protocol` is types-only and owns:

- One `Type.Object` schema per message variant.
- A `BusMessage` schema that is `Type.Union` over the variants, discriminated by a `kind` literal.
- `Static<typeof BusMessage>` re-exported as the `BusMessage` TS type.
- A `PROTOCOL_VERSION` constant (SemVer string).

The bus runtime imports both schema and type, validates every received line, and rejects connections whose `worker_hello.protocol_version` differs in major version from `PROTOCOL_VERSION`.

## The discriminated-union pattern

Every variant carries a `kind: Type.Literal('...')` field. The union is a plain `Type.Union([...])` over those variants — Typebox needs no dedicated "discriminated union" combinator for this case. The result compiles to JSON Schema `anyOf`, and `Static` produces a TS discriminated union, so `switch (msg.kind)` narrows correctly.

```ts
import { Type, Static } from '@sinclair/typebox'

export const PROTOCOL_VERSION = '1.0.0' as const

export const WorkerHello = Type.Object({
  kind: Type.Literal('worker_hello'),
  worker_id: Type.String(),
  protocol_version: Type.String(),
  capabilities: Type.Array(Type.String()),
})
export type WorkerHello = Static<typeof WorkerHello>

// ... AgentStatus, Subscribe, Publish, TopicMessage,
//     SnippetPush, Steer, HandoffRequest defined the same way ...

export const BusMessage = Type.Union([
  WorkerHello,
  AgentStatus,
  Subscribe,
  Publish,
  TopicMessage,
  SnippetPush,
  Steer,
  HandoffRequest,
])
export type BusMessage = Static<typeof BusMessage>
```

See `references/discriminated-unions.md` for pitfalls and the rationale against custom OpenAPI-style discriminators.

## Validating received frames

The bus receive loop reads a line, `JSON.parse`s it, and must reject non-`BusMessage` values before dispatch. Three options, in increasing speed and setup cost:

1. **`Value.Check(BusMessage, x)`** — boolean. Use for low-volume paths and tests. Pair with `Value.Errors` for diagnostics.
2. **`Value.Decode` / `Value.Parse`** — run decode transforms; `Parse` also applies `Default`/`Convert`/`Clean`. The bus has no transforms, so `Parse` is overkill and `Convert` would silently accept malformed peers — do not use it on the wire.
3. **`TypeCompiler.Compile(BusMessage)`** — JITs the schema once into a `.Check`/`.Errors` validator. Several times faster than `Value.Check`; the right choice for the receive loop. Compile once at module load and hold the reference.

```ts
import { TypeCompiler } from '@sinclair/typebox/compiler'
const BusMessageValidator = TypeCompiler.Compile(BusMessage)

export function decodeBusLine(line: string): BusMessage {
  const raw = JSON.parse(line)
  if (!BusMessageValidator.Check(raw)) {
    const errs = [...BusMessageValidator.Errors(raw)]
    throw new ProtocolError(`invalid bus message: ${errs[0]?.message}`, errs)
  }
  return raw as BusMessage
}
```

`references/validation.md` covers the `Value.*` matrix; `references/compiler.md` covers `TypeCompiler` lifecycle.

## Protocol version handling

`PROTOCOL_VERSION` is a plain exported `string` constant, *not* embedded in the schema — the schema must accept any string in `worker_hello.protocol_version` so the bus can read it and emit a clean rejection. The bus performs the check itself:

```ts
import { PROTOCOL_VERSION } from 'pi-swarm-protocol'
const [wantMajor] = PROTOCOL_VERSION.split('.')
const [gotMajor] = msg.protocol_version.split('.')
if (gotMajor !== wantMajor) closeWithError(...)
```

Bump the major whenever the wire format changes; that is the one signal peers use to refuse incompatible counterparts.

## When to load reference files

- New message variant, or unsure which `Type.*` builder to use: `references/builders.md`.
- Choosing between `Check`, `Errors`, `Decode`, `Parse`, `Cast`, `Default`: `references/validation.md`.
- Wiring `TypeCompiler` into a hot path: `references/compiler.md`.
- Designing or debugging the `kind`-tagged union: `references/discriminated-unions.md`.
