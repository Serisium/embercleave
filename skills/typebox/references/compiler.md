# `TypeCompiler` — ahead-of-time validators

Source: https://github.com/sinclairzx81/typebox (`@sinclair/typebox/compiler`), https://www.npmjs.com/package/@sinclair/typebox.

`TypeCompiler.Compile(schema)` walks a schema once and emits a JavaScript function (via `new Function`) that performs the same checks `Value.Check` would, but inlined with no per-call schema interpretation. The result is a `TypeCheck<T>` object with `.Check(value): boolean`, `.Errors(value): ValueErrorIterator`, plus `.Code()` (returns the generated source) and `.Schema()`.

```ts
import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

const BusMessageValidator = TypeCompiler.Compile(BusMessage)

if (!BusMessageValidator.Check(raw)) {
  for (const err of BusMessageValidator.Errors(raw)) {
    log.warn({ path: err.path, msg: err.message })
  }
}
```

## When AOT pays off

Compilation has a one-time cost (parsing the schema, generating the function). Per-call cost drops from "interpret the schema" to "inlined checks against `value`". Rough rule:

- Same schema validated **many** times (request handlers, the bus receive loop, every JSONL line off a socket): **compile once at module load**. Typebox's own benchmarks put compiled `.Check` close to the limit of what V8 can do on the value, often an order of magnitude over `Value.Check` for non-trivial schemas, and competitive with or faster than AJV.
- Schema seen **a handful of times** during startup or in a CLI: `Value.Check` is fine.
- Schema constructed dynamically per call: don't compile (you'd pay the compile cost every time). Keep `Value.Check` here, or memoize.

For `pi-swarm-protocol`, every line that arrives on the bus passes through one validator. Compile `BusMessage` once at startup and hold the reference for the process's lifetime.

## Keeping the compiled validator alive

The compiler returns an object that owns the generated function. It has no special teardown — the GC reclaims it when the last reference drops. Two reasonable patterns:

### Module-level singleton

```ts
// pi-swarm-protocol/dist/compiled.ts (in the consumer, not in pi-swarm-protocol itself)
import { BusMessage } from 'pi-swarm-protocol'
import { TypeCompiler } from '@sinclair/typebox/compiler'
export const BusMessageValidator = TypeCompiler.Compile(BusMessage)
```

Imported by the bus daemon. Compiled exactly once per process.

Note: `pi-swarm-protocol` is types-only per `arch.md` §4.1, so the *compiled* validator should not live there — it lives in whichever package owns the bus runtime. The schema and TS type are shared; the compiled artifact is per-consumer.

### Lazy / on-demand

```ts
let validator: TypeCheck<typeof BusMessage> | undefined
function getValidator() {
  return validator ??= TypeCompiler.Compile(BusMessage)
}
```

Useful when the validator might never be needed (e.g. CLI subcommands that don't touch the bus).

## Errors from the compiled validator

`.Errors(value)` yields the same `ValueError` records `Value.Errors` does (`{ type, schema, path, value, message }`). Iteration is lazy; `[...validator.Errors(value)]` materializes all of them. Cost is paid only on the failure path.

## Inspecting the generated code

`validator.Code()` returns the function body as a string. Useful for:

- Confirming a refinement actually compiled (e.g. that `format: 'uuid'` shows up).
- Sanity-checking schema changes before shipping.
- Reporting bugs upstream — paste `.Code()` output into the issue.

## Limits

- The compiler relies on `new Function`, so it does not work in environments that disallow code generation from strings (some CSP setups, some embedded JS runtimes). `Value.Check` is the fallback there.
- `Type.Transform` decode/encode steps are *not* run by the compiled `.Check` — `.Check` only validates structure. If a schema uses transforms and you need the decoded value, use `Value.Decode` (or compose `.Check` then `Value.Decode`). For the bus protocol there are no transforms, so this isn't a concern.
