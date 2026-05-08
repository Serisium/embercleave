# Async behaviour, fake timers, and the bus loop

Tests that exercise reconnect, backpressure, snippet flushing on `before_agent_start`, or any other event-driven code path live or die by how they handle time and pending I/O. Vitest's timer API (https://vitest.dev/api/vi.html) exposes both sync and async variants:

| Sync                              | Async                                  |
|-----------------------------------|----------------------------------------|
| `useFakeTimers(config?)`          | —                                      |
| `useRealTimers()`                 | —                                      |
| `advanceTimersByTime(ms)`         | `advanceTimersByTimeAsync(ms)`         |
| `runAllTimers()`                  | `runAllTimersAsync()`                  |
| `runOnlyPendingTimers()`          | `runOnlyPendingTimersAsync()`          |

The `*Async` variants flush microtasks scheduled by timer callbacks; the sync ones do not. Use them deliberately.

## Reconnect schedule

`reconnect-schedule.ts` returns `[250, 500, 1000, 2000]` capped at 2000ms. The unit test for the schedule itself is pure (no timers needed) — assert on the array. The integration-style test for reconnect-on-EOF should:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("connectToBus reconnect", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries with the documented schedule after EOF", async () => {
    const bus = new ScriptedBusClient([
      "eof",  // first connect EOFs immediately
      "ok",   // second connect succeeds
    ]);
    const p = connectToBus({ busClient: bus }, { socketPath: "/tmp/x" });

    await vi.advanceTimersByTimeAsync(250);
    // assert on what bus saw
    await vi.runAllTimersAsync();
    await p;
  });
});
```

`advanceTimersByTimeAsync` is the async-aware variant. Use it in any test where the code-under-test awaits a timer-resolved promise; the non-async `advanceTimersByTime` will not flush microtasks scheduled by the timer callback.

## Bus events in the manager

`bind-bus.test.ts` and `accept-worker.test.ts` use a `BusServerPort` stub that exposes `triggerConnection(socket)` etc. — synthetic events. Prefer that pattern over a real UDS:

- A real UDS binds a real path under `/tmp/`, races with parallel test workers, and leaks file handles on teardown.
- A synthetic-event stub gives deterministic ordering and is testable without I/O.

The single integration test that covers the real `node:net` adapter belongs in a file marked `*.integration.test.ts` and excluded from the default run via a tag if it ever materialises. As of v1, all manager tests use synthetic-event stubs.

## Snippet flush on `before_agent_start`

`flushSnippetsOnTurn` consumes the buffer when pi fires `before_agent_start`. The test triggers the handler manually:

```ts
const piHost = new StubPiHost();
let beforeStart!: BeforeAgentStartHandler;
piHost.onBeforeAgentStart = (h) => { beforeStart = h; };

const buffer = new SnippetBuffer();
buffer.push({ snippetId: "s1", content: "hello" });
flushSnippetsOnTurn({ piHost, buffer });

await beforeStart();   // simulate pi firing the hook
expect(piHost.sent[0]).toContain("<context-snippet>");
```

Capturing the handler via assignment is the canonical pattern; do not try to grab it via `vi.spyOn` on the stub class.

## Don't sleep

Never write `await new Promise((r) => setTimeout(r, 50))` to "let things settle". It is non-deterministic and slow. If a test needs to wait, identify what it is waiting for:

- A timer? Use fake timers and advance.
- A promise from the use-case? Await it directly.
- An event from a port stub? Make the stub return a promise that resolves when the event fires.

If none of those apply, the use-case is probably doing fire-and-forget work that the test cannot observe, which is a design issue in the use-case, not in the test.

## Cleanup discipline

- `vi.useRealTimers()` in `afterEach`. Forgetting this contaminates the next test in the file.
- Close any port-level resource (`bus.close()`) the test acquires, even on failure. Use `try/finally` or `afterEach`.
- Do not leave dangling promises. If a use-case spawns a long-running loop, it should expose a stop method on its returned handle; await that in cleanup.
