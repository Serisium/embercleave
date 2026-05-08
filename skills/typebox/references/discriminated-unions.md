# Discriminated unions in Typebox

Source: https://github.com/sinclairzx81/typebox, https://github.com/sinclairzx81/typebox/discussions/988, https://www.npmjs.com/package/@sinclair/typebox.

The `pi-swarm-protocol` bus uses one tagged-union type, `BusMessage`, with the `kind` field as the discriminator. This is the canonical Typebox tagged-union pattern.

## The pattern

Each variant is a `Type.Object` whose `kind` property is pinned with `Type.Literal` to a unique string. The wrapping union is plain `Type.Union`.

```ts
import { Type, Static } from '@sinclair/typebox'

export const WorkerHello = Type.Object({
  kind: Type.Literal('worker_hello'),
  worker_id: Type.String(),
  protocol_version: Type.String(),
  capabilities: Type.Array(Type.String()),
})

export const AgentStatus = Type.Object({
  kind: Type.Literal('agent_status'),
  worker_id: Type.String(),
  agent_id: Type.String(),
  state: Type.Union([
    Type.Literal('idle'),
    Type.Literal('busy'),
    Type.Literal('handoff'),
  ]),
})

export const Subscribe = Type.Object({
  kind: Type.Literal('subscribe'),
  topics: Type.Array(Type.String()),
})

// ... Publish, TopicMessage, SnippetPush, Steer, HandoffRequest similarly ...

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
// Equivalent to:
// type BusMessage =
//   | { kind: 'worker_hello'; worker_id: string; ... }
//   | { kind: 'agent_status'; ... }
//   | ...
```

TypeScript treats this as a discriminated union because `kind` is a literal type in every member. `switch (msg.kind)` narrows correctly:

```ts
function handle(msg: BusMessage) {
  switch (msg.kind) {
    case 'worker_hello':  return onHello(msg)   // narrowed to WorkerHello
    case 'agent_status':  return onStatus(msg)
    case 'subscribe':     return onSubscribe(msg)
    // ...
    default: { const _exhaustive: never = msg; throw new Error('unreachable') }
  }
}
```

The `never` assignment in `default` makes adding a new variant a compile error in every consumer that hasn't handled it — useful when extending the protocol.

## Why plain `Type.Union` is the right choice here

The JSON Schema produced by `Type.Union` is `anyOf: [...]`. A validator (`Value.Check` or compiled) walks each branch and accepts the first match. Because each branch has a different literal `kind`, at most one branch can ever match, and validation effectively becomes "switch on `kind`, then validate that branch."

Some OpenAPI workflows want the alternate `oneOf + discriminator: { propertyName }` shape. That format is for OpenAPI tooling, not for Typebox runtime validation, and Typebox does not need it to validate a tagged union. Stick with `Type.Union` unless an external OpenAPI consumer specifically requires the `discriminator` keyword. (See discussion #988 — community implementations of a custom `DiscriminatedUnion` exist for OpenAPI compatibility, but they are not part of the core API.)

## Pitfalls

- **`additionalProperties` on variants.** If a sender adds an unknown field, an open schema (the default) accepts it. That's usually what you want for forward compatibility; if you instead want strict rejection, set `additionalProperties: false` on each `Type.Object`. Be deliberate — once strict, a peer running a newer version that adds a field will be rejected by an older validator. The protocol-version major bump is the lever to use when that happens.
- **Forgetting the literal.** `kind: Type.String()` *will* validate, but it destroys the discriminated-union nature on the TS side: `Static` collapses to `{ kind: string; ... } | ...` and `switch` no longer narrows. Always use `Type.Literal('...')`.
- **Reusing a `kind` value across variants.** Two branches with the same literal `kind` make narrowing ambiguous and validation order-dependent. Each variant must use a unique literal.
- **Nesting discriminators.** A variant can itself contain a sub-union with its own discriminator (e.g. `AgentStatus.state` above using literal-union). That works fine; it just stacks one tagged union inside a field of another.
- **Schema identity.** Build each variant schema once and reuse the reference inside `Type.Union`. Don't reconstruct on every call — the compiled validator is keyed on identity, and rebuilding throws away the cache.

## Adding a new message kind

1. Add a new `Type.Object` with a unique `kind: Type.Literal(...)`.
2. Append it to the array passed to `Type.Union` for `BusMessage`.
3. Re-export the variant schema and `Static` type.
4. Bump `PROTOCOL_VERSION` — minor if the change is additive (old peers can ignore the new kind), major if existing variants changed shape (old peers will misparse).
5. Recompile and rerun the bus tests.
