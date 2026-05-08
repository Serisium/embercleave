# Stubbing ports vs. `vi.fn` / `vi.mock`

embercleave uses ports-and-adapters (`AGENTS.md` "Implementation conventions"), so every use-case takes its dependencies as a plain object of port interfaces. Tests have three knobs to choose from; pick the smallest one that proves the behaviour.

## 1. Hand-written stub class (default)

A one-page `class StubX implements XPort` is the cheapest mock when you only need to:

- Record what the use-case sent through the port.
- Return canned responses for read methods.
- Implement other methods as no-ops.

```ts
class CapturingBusClient implements BusClientPort {
  lines: string[] = [];
  async connect(_p: string, _h: BusClientHandlers): Promise<void> {}
  async send(line: string): Promise<void> {
    this.lines.push(line);
  }
  async close(): Promise<void> {}
}
```

Why it wins:

- TypeScript checks the port shape — if the port grows a method, every stub breaks at compile time, which is what you want.
- No module-graph hoisting, no `vi.mocked()` casts.
- Trivially shareable across tests (export it from `test/_stubs/<name>.ts` if reused).

Use this for: capturing wire frames, stubbing `PiHostPort`, stubbing `FilesystemPort`, stubbing `SystemdUnitsPort`.

## 2. `vi.fn()` for individual methods

Reach for `vi.fn()` when you need its bookkeeping:

- `expect(fn).toHaveBeenCalledWith(...)` for arg matchers.
- `fn.mockResolvedValueOnce(x)` for sequential return values.
- `fn.mock.calls.length` for call-count assertions a captured array makes ugly.

Compose it with a stub class when only one method needs the bookkeeping:

```ts
class StubPiHost implements PiHostPort {
  registerTool = vi.fn<(d: PiToolDefinition) => void>();
  onEvent(_h: (event: WorkerPiEvent) => void): void {}
  onBeforeAgentStart(_h: BeforeAgentStartHandler): void {}
  sendUserMessage(_text: string): void {}
}

it("registers swarm_publish on session_start", () => {
  const piHost = new StubPiHost();
  // ...trigger registration...
  expect(piHost.registerTool).toHaveBeenCalledWith(
    expect.objectContaining({ name: "swarm_publish" }),
  );
});
```

## 3. `vi.mock()` of a whole module

Only when the unit-under-test imports a concrete adapter module directly (no port indirection) and you cannot refactor it to use a port. In this codebase that is almost never — adapters are wired in `framework/extension-entry.ts` and use-cases take ports — so `vi.mock` should not appear in new tests.

If you find yourself reaching for it, first check whether the dependency should be lifted to a port. The dependency rule (`adapters → use-cases → domain`, never reversed) makes ports cheap to add.

## Anti-patterns to avoid

- **Mocking `node:fs` or `node:net` directly.** Wrap them in a `FilesystemPort` / `BusClientPort` adapter and stub the port. Tests should not care about Node built-ins.
- **`as any` to satisfy a port.** If the stub does not type-check, the port is genuinely changing — fix the call site, do not silence the compiler.
- **Sharing one stub instance across `it` blocks.** Construct in each test (or in `beforeEach`) so per-test state never leaks. Captured arrays (`lines: string[] = []`) are stateful by definition.

## When `vi.mock` *is* the right answer

The one place `vi.mock` is appropriate is mocking a leaf module the codebase does not own, when no port abstracts it and creating one would be over-engineering. Example: stubbing `node:child_process` in a test for a use-case that the team has decided not to put behind a port. Even then, the bar is high — the existing `quadlet` package wraps `execFile` behind `SystemdUnitsPort` precisely so tests can stub it the easy way.
