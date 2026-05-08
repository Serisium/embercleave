# Typebox `Value.*` validation API

Source: https://github.com/sinclairzx81/typebox (`Value` namespace), https://www.npmjs.com/package/@sinclair/typebox. Discussions: https://github.com/sinclairzx81/typebox/discussions/918, https://github.com/sinclairzx81/typebox/discussions/1089.

`import { Value } from '@sinclair/typebox/value'`. Each function takes `(schema, value)` and is *non-compiled* — the schema is interpreted on every call. Good for cold paths and ad-hoc checks. For hot paths use `TypeCompiler.Compile` (see `compiler.md`).

## `Value.Check(schema, value): boolean`

Pure boolean predicate. Walks the schema once and returns `true`/`false`. No allocation of error objects, no transforms applied. Use this when:

- You only need yes/no.
- The schema has no `Type.Transform`.
- You will produce errors yourself (or use `Value.Errors` on the failure path).

```ts
if (!Value.Check(BusMessage, raw)) reject()
```

## `Value.Errors(schema, value): ValueErrorIterator`

Lazy iterator of `{ type, schema, path, value, message }` records. Spread it into an array to materialize all errors:

```ts
const errs = [...Value.Errors(BusMessage, raw)]
// each: { path: '/kind', message: 'Expected union value', value: '...' }
```

Iteration short-circuits if you `break`, so reading just the first error is cheap. Pair with `Value.Check`: call `Check` on the happy path, only build `Errors` when reporting.

## `Value.Decode(schema, value): StaticDecode<T>`

Validates *and* applies any `Type.Transform(...).Decode(...)` callbacks defined in the schema, returning the decoded value. For a schema with no transforms, `Decode` is equivalent to `Check`-then-pass-through except it throws on failure rather than returning a boolean. Use when the schema has at least one `Type.Transform` and you want the decoded shape.

```ts
const msg = Value.Decode(SchemaWithDateTransform, raw)
// raw.timestamp is string on the wire; msg.timestamp is a Date here
```

## `Value.Parse(schema, value): StaticDecode<T>`

The "kitchen sink" entry point. The maintainer describes its behaviour as roughly:

```ts
function Parse(schema, value) {
  const cloned    = Value.Clone(value)
  const defaulted = Value.Default(schema, cloned)     // fill missing defaults
  const converted = Value.Convert(schema, defaulted)  // string "8080" -> 8080, etc.
  const cleaned   = Value.Clean(schema, converted)    // strip unknown props
  return Value.Decode(schema, cleaned)
}
```

Handy for parsing config files or HTTP bodies where coercion and defaulting are wanted. **Do not use on the bus receive path.** Bus messages must round-trip byte-for-byte; coercion would silently accept malformed peers.

## `Value.Cast(schema, value)`

Specialized data-migration helper that aggressively reshapes `value` toward the schema (filling defaults, dropping extras, coercing primitives). The maintainer recommends *avoiding* it for general parsing — its semantics are tuned for migrating older persisted state, not validating fresh input. Skip it for `pi-swarm-protocol`.

## `Value.Default(schema, value)` / `Value.Convert(...)` / `Value.Clean(...)` / `Value.Clone(...)` / `Value.Equal(a, b)` / `Value.Hash(value)`

Lower-level utilities. Useful in tests and in tooling around the schemas; not generally needed inside the bus.

## When each is appropriate inside embercleave

| Code path | Use |
|---|---|
| Bus receive loop (per-line) | Compiled validator from `TypeCompiler.Compile`, fall back to `Value.Errors` for the rejection message |
| Tests asserting a schema accepts/rejects a fixture | `Value.Check` + spread `Value.Errors` |
| Schema introspection / debugging | `Value.Errors`, `Value.Hash` |
| Anywhere on the wire | **Never** `Value.Parse`, `Value.Cast`, or `Value.Convert` — they hide protocol bugs |

## Failure mode reminder

`Value.Check` returns `false` and never throws. `Value.Decode` and `Value.Parse` throw `TransformDecodeCheckError` / `TransformDecodeError` on failure. Compiled validators return `false` from `.Check` and yield from `.Errors`, matching the `Value.Check` contract. Pick the API whose failure mode matches what the caller expects.
