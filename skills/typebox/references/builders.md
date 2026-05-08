# Typebox builders cheat sheet

Source: https://github.com/sinclairzx81/typebox, https://www.npmjs.com/package/@sinclair/typebox.

All builders live on `Type` from `@sinclair/typebox`. Every builder returns a `TSchema` value that is *both* a JSON Schema document and a TS type carrier; `Static<typeof T>` extracts the TS type.

## Primitives

```ts
Type.String()                  // string
Type.String({ minLength: 1 })  // with refinement
Type.String({ format: 'uuid' })
Type.Number()
Type.Integer()
Type.Boolean()
Type.Null()
Type.Undefined()
Type.Any()
Type.Unknown()
Type.Never()
```

Refinements such as `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `multipleOf`, and `format` (`email`, `uuid`, `uri`, `date-time`, etc.) are passed as a JSON-Schema-style options object. Custom formats register through `FormatRegistry`.

## Literals and enums

```ts
Type.Literal('worker_hello')       // exactly the string "worker_hello"
Type.Literal(42)
Type.Literal(true)

Type.Union([
  Type.Literal('busy'),
  Type.Literal('idle'),
  Type.Literal('handoff'),
])                                  // string-literal union — preferred over Type.Enum

Type.Enum(MyTsEnum)                 // also supported, for actual TS enums
```

## Objects

```ts
Type.Object({
  worker_id: Type.String(),
  capabilities: Type.Array(Type.String()),
})

Type.Object({ ... }, { additionalProperties: false })  // strict
```

`Type.Optional(T)` marks a property optional; `Type.Readonly(T)` marks it readonly. They compose: `Type.Readonly(Type.Optional(Type.String()))`.

```ts
Type.Object({
  trace_id: Type.Optional(Type.String()),
})
```

`Type.Partial(T)`, `Type.Required(T)`, `Type.Pick(T, [...keys])`, `Type.Omit(T, [...keys])`, `Type.KeyOf(T)`, `Type.Composite([A, B])` (intersection-as-object), `Type.Extends(...)`.

## Arrays, tuples, records

```ts
Type.Array(Type.String())
Type.Array(Type.String(), { minItems: 1, uniqueItems: true })

Type.Tuple([Type.String(), Type.Number()])

Type.Record(Type.String(), Type.Number())     // { [k: string]: number }
Type.Record(Type.Union([                      // restricted key set
  Type.Literal('cpu'),
  Type.Literal('mem'),
]), Type.Number())
```

## Unions and intersections

```ts
Type.Union([A, B, C])           // anyOf
Type.Intersect([A, B])          // allOf

// Discriminated union pattern (see references/discriminated-unions.md):
Type.Union([WorkerHello, AgentStatus, Publish, ...])
```

For the bus protocol, a plain `Type.Union` over objects each carrying a unique `kind: Type.Literal(...)` is the right tool. Avoid building custom OpenAPI-style `discriminator` objects unless something downstream requires that exact JSON Schema shape.

## Indexing and references

```ts
Type.Index(Schema, ['field'])        // T['field']
Type.Ref(Schema)                     // $ref by $id
Type.Recursive(This => Type.Object({
  value: Type.String(),
  next: Type.Optional(This),
}))
```

`Type.Recursive` is the supported way to model self-referential structures (linked lists, trees). It threads a placeholder through the callback so the schema can refer to itself.

## Transforms (runtime decode/encode)

```ts
Type.Transform(Type.String({ format: 'date-time' }))
  .Decode(s => new Date(s))
  .Encode(d => d.toISOString())
```

Only relevant if a variant needs to materialize a non-JSON value (Date, BigInt, etc.) on receive. The `pi-swarm-protocol` wire format is plain JSON, so transforms should generally be avoided in shared schemas — keep variants serializable so both sides see the same shape.

## Static type extraction

```ts
import { Type, Static } from '@sinclair/typebox'

const WorkerHello = Type.Object({
  kind: Type.Literal('worker_hello'),
  worker_id: Type.String(),
})
type WorkerHello = Static<typeof WorkerHello>
// { kind: 'worker_hello'; worker_id: string }
```

Re-export both the schema (runtime value) and the TS type (compile-time only) from `pi-swarm-protocol` so consumers can use whichever they need.
