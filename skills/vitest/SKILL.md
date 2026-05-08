---
name: vitest
description: Reference for Vitest, the test runner used by every behavioural package in the embercleave workspace. Use when writing or modifying `*.test.ts` files under `packages/<pkg>/test/`, choosing between hand-written stub classes and `vi.fn` / `vi.mock`, asserting on async behaviour, structuring `describe` / `it` blocks for use-case tests, debugging test imports that cross the dist/src boundary (NodeNext `.js` extensions still required in tests), or reasoning about why every package's `test` script is `vitest run --passWithNoTests`. Triggers: vitest, `describe`, `it`, `expect`, `vi.fn`, `vi.mock`, `vi.spyOn`, `--passWithNoTests`, test colocation, mocking the bus / pi host, `BusClientPort` / `PiHostPort` stubs, `connect-to-bus.test.ts`, ports-and-adapters tests.
---

# Vitest in embercleave

## What Vitest is

Vitest (https://vitest.dev, https://www.npmjs.com/package/vitest, API reference at https://vitest.dev/api/vi.html) is a Vite-native test runner with a Jest-compatible API: `describe`, `it`, `expect`, plus `vi.*` for mocks, spies, timers, and module hoisting. embercleave pins `vitest@^2.1.8` at the workspace root; every behavioural package re-uses that pin transitively. There is no per-package `vitest.config.ts` — defaults are sufficient because the tests run TS sources through Vite's on-the-fly compilation rather than the built `dist/`.

## Role in embercleave

Per `AGENTS.md` "Implementation conventions", every package keeps tests under `packages/<pkg>/test/<thing>.test.ts`, colocated with the package, never in a top-level `tests/` tree. The package script is intentionally:

```json
"test": "vitest run --passWithNoTests"
```

`run` (not the watch default) is required so `pnpm -r run test` exits cleanly in CI. `--passWithNoTests` exists so a freshly-scaffolded package without tests yet does not fail the workspace-wide command.

`vitest` invoked with no subcommand auto-detects the environment: watch mode in interactive terminals, single-run when stdout is not a TTY (CI). `vitest run` makes the single-run intent explicit; the codebase prefers it in `package.json` so the script behaviour is independent of who calls it (https://vitest.dev/guide/cli.html). Doc verbatim:

> Start Vitest in the current directory. Will enter the watch mode in development environment and run mode in CI (or non-interactive terminal) automatically.

The test files import the source they exercise via the **same `.js`-extension NodeNext-style relative path used in production code** — Vite/Vitest resolves it through TS source, but the suffix must still be `.js` to match `tsc -b` output (see `tsc-project-refs` skill). That is why every test does:

```ts
import { connectToBus } from "../src/use-cases/connect-to-bus.use-case.js";
```

## Test style: hand-written stubs over `vi.mock`

The dominant pattern in this codebase is **manual stub classes implementing the port interface**, not `vi.mock` of the adapter module. This is a deliberate consequence of ports-and-adapters: ports are small TS interfaces, so a one-line `class StubPiHost implements PiHostPort` is shorter than the `vi.mock` ceremony and does not require module-graph manipulation.

```ts
// packages/worker/test/handle-steer.test.ts
class StubPiHost implements PiHostPort {
  sent: string[] = [];
  onEvent(_h: (event: WorkerPiEvent) => void): void {}
  registerTool(_d: PiToolDefinition): void {}
  onBeforeAgentStart(_h: BeforeAgentStartHandler): void {}
  sendUserMessage(text: string): void {
    this.sent.push(text);
  }
}

describe("handleSteer", () => {
  it("forwards the message to pi.sendUserMessage", () => {
    const piHost = new StubPiHost();
    handleSteer({ piHost }, "stop and summarise");
    expect(piHost.sent).toEqual(["stop and summarise"]);
  });
});
```

Use `vi.fn()` only when you need call-count or argument-matchers and a stub class would be overkill. Vitest 2.x exports `fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>`, so the function-type generic (`vi.fn<(d: PiToolDefinition) => void>()`) is the recommended way to type a captured mock. Use `vi.mock()` only when you genuinely need to replace a module the use-case imports directly (rare — most code goes through ports). `vi.mock()` calls are hoisted to the top of the file by Vitest's transformer (https://vitest.dev/guide/mocking.html), so factory expressions cannot close over file-scope variables.

## Per-test-file lint override

`biome.json` includes a test-only override that turns off `noNonNullAssertion`. That is why test code can write `bus.lines[0]!` without a lint failure. Keep non-null assertions in test files; do not propagate them into `src/`. See the `biome` skill for the override list.

## Async, timers, and the bus

The bus uses `node:net` UDS and is event-driven; tests that exercise reconnect or backpressure should:

- Prefer `vi.useFakeTimers()` over real `setTimeout` when asserting on the reconnect schedule (`reconnect-schedule.ts`). Restore with `vi.useRealTimers()` in an `afterEach` so other tests are not contaminated.
- Use `await` on every promise the use-case returns; never `setImmediate` or `process.nextTick` to "let it run" — that is a flake source.
- For socket round-trips inside a single test, prefer a `CapturingBusClient implements BusClientPort` (see `handle-steer.test.ts`) over spinning up a real UDS.

## Idiomatic assertions

- `expect(x).toEqual(y)` for structural equality (the default for capturing JSON lines on the wire).
- `expect(x).toBe(y)` only for primitives or referential identity.
- `expect(JSON.parse(bus.lines[0]!)).toEqual({ kind: "handoff_request", ... })` is the canonical wire-format assertion shape used across `manager` and `worker` tests.
- Avoid `expect.any(Function)` and matcher acrobatics; prefer asserting on the concrete shape the use-case produces.

## Running

- `pnpm -r run test` — workspace-wide.
- `pnpm --filter @serisium/embercleave-worker run test` — a single package.
- `pnpm --filter @serisium/embercleave-worker exec vitest <pattern>` — interactive watch on a specific package.

There is no global `vitest` invocation at the workspace root; each package owns its own run.

## When to load reference files

- Designing a stub for a new port, or deciding stub-vs-`vi.fn`: `references/stubbing-ports.md`.
- Writing a fake-timer or backpressure test: `references/async-and-timers.md`.
