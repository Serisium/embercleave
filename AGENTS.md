## Project: embercleave

A hardened, image-based fedora-bootc host that runs a swarm of `pi` coding
agents under Quadlet-managed rootless Podman. All swarm functionality is
implemented as four TypeScript pi extensions (`@serisium/embercleave-protocol`,
`@serisium/embercleave-worker`, `@serisium/embercleave-manager`, `@serisium/embercleave-quadlet`) talking over a
JSONL Unix-domain bus. A single unprivileged `swarm` user owns all state;
isolation between workers is by container, not by Linux user.

The architecture spec is **`arch.md`** at the repo root. Read it before any
non-trivial change. Skills below cite it by line number.

## Layered model (from `arch.md` §2)

| Layer | What it is                              | Skill(s)                              |
|-------|------------------------------------------|----------------------------------------|
| 1     | Hardened OS image (fedora-bootc)        | [`bootc`](skills/bootc/SKILL.md)       |
| 2     | Container runtime + supervision         | [`podman`](skills/podman/SKILL.md), [`quadlet`](skills/quadlet/SKILL.md), [`systemd-units`](skills/systemd-units/SKILL.md) |
| 3     | Pi runtime                              | [`pi-coding-agent`](skills/pi-coding-agent/SKILL.md) |
| 4     | Agent-facing extensions (TypeScript)    | [`pi-coding-agent`](skills/pi-coding-agent/SKILL.md), [`typebox`](skills/typebox/SKILL.md) |
| Build | TS build / test / lint tooling          | [`tsc-project-refs`](skills/tsc-project-refs/SKILL.md), [`vitest`](skills/vitest/SKILL.md), [`biome`](skills/biome/SKILL.md) |
| Meta  | Skill authoring & doc-sync workflow     | [`skill-maintenance`](skills/skill-maintenance/SKILL.md) |
| v2    | Deferred                                | [`remotecompose`](skills/remotecompose/SKILL.md), [`mcp-gateway`](skills/mcp-gateway/SKILL.md) |

## How to use these skills

The `skills/` directory follows Anthropic's progressive-disclosure layout:

- **`SKILL.md`** — load on trigger. Contains the project-specific overview
  and a decision tree pointing at the references.
- **`references/*.md`** — load only when the SKILL.md routes you there.
  Deep details (full APIs, gotchas, design notes) that would waste context
  if eagerly loaded.

When a task lands in one of the trigger conditions below, read that skill's
`SKILL.md` first; only follow the reference links it surfaces.

## Skill trigger index

### [`bootc`](skills/bootc/SKILL.md) — Layer 1 image

Load when: editing the project Containerfile, the `/etc/containers/systemd/`
layout, the `swarm` user setup, or `/etc/tmpfiles.d/`; running or reasoning
about `bootc status`/`upgrade`/`switch`/`install`/`rollback`; deciding what
survives a `bootc upgrade` vs. what is wiped; debugging why something added
to the Containerfile did not appear on the running host.

References: `containerfile-authoring.md`, `cli.md`, `update-model.md`.

### [`podman`](skills/podman/SKILL.md) — Layer 2 runtime

Load when: working with rootless Podman setup (subuid/subgid, user
namespaces); enabling or querying the user `podman.socket` REST API from the
manager; managing credentials with `podman secret` and the Quadlet `Secret=`
directive; embedding the worker image into the bootc base via `podman load`;
implementing `swarm_inspect`.

References: `rest-api.md`, `secrets.md`, `rootless.md`, `image-management.md`.

### [`quadlet`](skills/quadlet/SKILL.md) — Layer 2 supervision (declarative)

Load when: editing `embercleave-worker@.container`, `embercleave-mgr.container`, or
`embercleave.target`; creating drop-ins under `*.container.d/`; reasoning about
template instances; deciding whether `daemon-reload` is required; mapping
`podman run` flags to `[Container]` keys; hitting Podman issue #25902
(templated `.volume` cross-ref) or #17662 (`DefaultInstance=` ignored).

References: `unit-types.md`, `template-units.md`, `dropins.md`,
`key-mapping.md`.

### [`systemd-units`](skills/systemd-units/SKILL.md) — Layer 2 supervision (lifecycle)

Load when: writing or editing user units / `embercleave.target` /
`/etc/tmpfiles.d/embercleave.conf`; implementing `swarm_logs` (journald) or
`swarm_list` (unit enumeration); picking `After=`/`PartOf=`/`BindsTo=`;
tuning `Restart=` for crash recovery; explaining `loginctl enable-linger`;
debugging a user unit that did not come up at boot.

References: `user-units.md`, `templates-and-specifiers.md`, `tmpfiles.md`,
`journald.md`, `ordering.md`.

### [`pi-coding-agent`](skills/pi-coding-agent/SKILL.md) — Layers 3 & 4

Load when: authoring or modifying any of the four `@serisium/embercleave-*` extensions;
registering pi tools (`pi.registerTool`); hooking lifecycle events
(`session_start`, `before_agent_start`, `turn_start`, `tool_*`, `agent_end`,
`session_shutdown`); calling `pi.sendUserMessage` to inject prompts;
rendering UI widgets via `ctx.ui.setWidget`; working with pi sessions
(`--no-session`, `--continue`, `.pi/agent/sessions/`); driving pi
externally via `--mode rpc`; wiring `EMBERCLEAVE_AGENT_ID` into a worker.

This skill explicitly flags places where the documented pi API diverges
from arch.md's assumptions (e.g. `before_turn` is actually
`before_agent_start`; `thinking`/`idle`/`tool:<name>` are derived from
`agent_start`/`agent_end`/`tool_execution_*`, not single events). Verify
against `badlogic/pi-mono` before merging.

References: `extension-api.md`, `cli-flags.md`, `rpc-mode.md`, `sessions.md`.

### [`typebox`](skills/typebox/SKILL.md) — wire schema for `@serisium/embercleave-protocol`

Load when: defining or modifying the `BusMessage` discriminated union or
its variants (`worker_hello`, `agent_status`, `subscribe`, `publish`,
`topic_message`, `snippet_push`, `steer`, `handoff_request`); adding a new
message kind; deriving TS types via `Static<typeof T>`; validating incoming
JSONL on the bus receive loop; choosing between `Value.Check` /
`Value.Decode` / `Value.Parse` / `TypeCompiler.Compile`; encoding the
protocol-version constant or the major-version mismatch check.

References: `builders.md`, `validation.md`, `compiler.md`,
`discriminated-unions.md`.

### [`tsc-project-refs`](skills/tsc-project-refs/SKILL.md) — TS build

Load when: editing `tsconfig.base.json` or any per-package `tsconfig.json`;
adding a new workspace package or wiring a new cross-package dependency in
`references[]`; debugging a `Cannot find module` that disappears under
`moduleResolution: node` but fails under NodeNext; explaining why every
relative import ends in `.js` even though source files are `.ts`; choosing
between `import type` and a value import; cleaning a stale
`dist/.tsbuildinfo`.

References: `adding-a-package.md`, `nodenext-resolution.md`.

### [`vitest`](skills/vitest/SKILL.md) — test runner

Load when: writing or modifying any `*.test.ts` under `packages/<pkg>/test/`;
deciding between a hand-written `class StubX implements XPort` and
`vi.fn` / `vi.mock`; writing a fake-timer test for the reconnect schedule
or any other event-driven path; asserting on JSONL bus frames captured
into a stub; explaining why every package script is
`vitest run --passWithNoTests`.

References: `stubbing-ports.md`, `async-and-timers.md`.

### [`biome`](skills/biome/SKILL.md) — linter + formatter + import organiser

Load when: running `pnpm lint` / `pnpm fix` / `pnpm format`; debugging a CI
lint failure; deciding whether a file legitimately needs a `default
export` (only `framework/extension-entry.ts` does); using a non-null
assertion in production vs. test code; reading or editing `biome.json`;
adding a new override block; explaining why a file's formatting changed
on checkout.

References: `rules-and-overrides.md`.

### [`skill-maintenance`](skills/skill-maintenance/SKILL.md) — Meta: keeping skills in sync with docs

Load when: about to `WebFetch` or `WebSearch` documentation for any
library this repo uses (vitest, biome, typebox, pi-coding-agent, the
TypeScript handbook, podman, Quadlet, fedora-bootc, systemd, etc.) to
fill a gap in a SKILL.md or `references/<topic>.md`; about to add a new
skill under `skills/`; suspecting a SKILL.md claim is unverified,
paraphrased, or version-stale; patching a reference file with newly
fetched documentation. Captures the verify→quote→cite→sync workflow:
fetch authoritative docs, quote load-bearing claims verbatim, add inline
parenthetical URL citations matching the `typebox` style, and update
this `AGENTS.md` (trigger index + layered-model table) for any new
skill.

References: `research-and-cite.md`, `authoring-conventions.md`.

### [`remotecompose`](skills/remotecompose/SKILL.md) — DEFERRED v2

Load **only** when the user explicitly mentions RemoteCompose, RC, the
`.rc` document format, the `embercleave-rc-server.container` bridge, or the
WebSocket-to-RC bridge work. Do not load for general UI work or for the
manager extension itself. Captures arch.md §10's open question on
`remote-core` Kotlin/Native artifacts (current finding: `remote-core`
ships `-android` + `-jvm` only at `1.0.0-alpha010`; the bridge should be a
JVM container).

References: `concept.md`, `artifacts.md`, `bridge-design.md`.

### [`mcp-gateway`](skills/mcp-gateway/SKILL.md) — DEFERRED v2

Load when: designing or implementing per-worker network isolation;
mediating MCP tool-call traffic for audit/policy; integrating
`service-gator`; evaluating an MCP Gateway candidate (Docker MCP Gateway,
mcp-context-forge, etc.); reducing prompt-injection blast radius beyond
what rootless Podman + Quadlet provides. **NOT for v1** — arch.md §1
explicitly trusts all workers equally.

References: `mcp-overview.md`, `egress-policy-design.md`,
`service-gator.md`, `gateway-options.md`.

## Cross-cutting authority rules (from `arch.md` §8)

These rules cut across multiple skills and must be respected in any change:

- Workers have **no Podman socket access** and **no write permission** to
  `~/.config/containers/systemd/`. Only the manager pi can spawn or stop
  workers, push snippets, steer, or read logs.
- The manager's pi runs in its own Quadlet. Its tools are callable by its
  own LLM — that is the orchestration feature, but it means a prompt
  injection that reaches the manager can spawn or stop sibling Quadlets.
  v1 mitigation is the rootless-Podman blast radius; v2 mitigation is the
  `mcp-gateway` skill above.
- The bootc image and the Quadlet template are image-managed and read-only
  at runtime. Don't try to mutate them on a running host; rebuild the
  image and `bootc upgrade`.

## Implementation conventions

The repo is a pnpm workspace under `packages/`. Each behavioural package
(`@serisium/embercleave-worker`, `@serisium/embercleave-manager`, `@serisium/embercleave-quadlet`)
ships ports-and-adapters with three folders inside `src/`: `domain/`,
`use-cases/`, `adapters/`, plus `framework/extension-entry.ts` for DI
wiring. The dependency rule is `adapters → use-cases → domain`, never
reversed. `@serisium/embercleave-protocol` is types-only with a flat `src/` layout.

Per-package navigation (created as packages land):

- [`packages/protocol/AGENTS.md`](packages/protocol/AGENTS.md)
- [`packages/worker/AGENTS.md`](packages/worker/AGENTS.md)
- [`packages/manager/AGENTS.md`](packages/manager/AGENTS.md)
- [`packages/quadlet/AGENTS.md`](packages/quadlet/AGENTS.md)

### File-naming rules

1. **One exported symbol per file.** File named after the symbol.
   `worker-registry.ts` exports `WorkerRegistry`;
   `connect-to-bus.use-case.ts` exports `connectToBus`.
2. **No default exports inside packages.** Only
   `framework/extension-entry.ts` uses `export default`, because pi
   extensions require it.
3. **No internal barrel files.** Only `src/index.ts` is a barrel and only
   re-exports public API. Internal imports use concrete file paths
   (`../domain/worker-registry`, never `../domain`).
4. **Filename suffix encodes role.** `*.use-case.ts`, `*.adapter.ts`,
   `*.port.ts`, `*.test.ts`. No-suffix files in `domain/` are pure types
   and functions. Grep `*.use-case.ts` to enumerate behaviours.
5. **Ports next to their first adapter.** `*.port.ts` lives in `adapters/`,
   not `domain/`. Use-cases import the port; framework wires the adapter.
6. **Tests colocated by package.** `packages/<pkg>/test/<thing>.test.ts`.
7. **Soft 300 LOC ceiling per file.**
8. **JSDoc only when types are ambiguous.** Comments cite `arch.md:NNN`
   for architectural decisions.
9. **`workspace:*` for cross-package deps.** Never write a version range.
10. **No service locator, no DI container.** Constructor injection in
    `framework/extension-entry.ts`.

### Tooling commands

- `pnpm install` — install workspace deps
- `pnpm -r build` — build all packages (`tsc -b`)
- `pnpm -r test` — run vitest in all packages
- `pnpm lint` — `biome check .`
- `pnpm fix` — `biome check --write .`

## Adding or maintaining a skill

The full workflow — including how to verify load-bearing claims against
official docs, citation conventions, and frontmatter rules — lives in
the [`skill-maintenance`](skills/skill-maintenance/SKILL.md) skill. Load
it whenever you author, audit, or patch a skill, or whenever you fetch
upstream docs for one of the project's libraries.

Quick summary (the skill has the full version):

1. Create `skills/<name>/SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: <lowercase-hyphen-name>
   description: <what + when to load. ≤1024 chars. Be specific about triggers.>
   ---
   ```
2. Keep `SKILL.md` short (≈5KB target). It is the decision tree, not the
   manual. Push depth into `skills/<name>/references/<topic>.md`.
3. Reference files exist to be loaded on demand. Each should be a single
   topic that a SKILL.md decision tree can route to.
4. Add a row to the trigger index above with explicit load conditions.
5. Cite `arch.md` by line number where claims are load-bearing
   (`arch.md:NNN`).
6. Cite upstream docs inline (parenthetical URL at the claim, matching
   the `typebox` SKILL.md style). Quote verbatim for exact strings.
   No `## Sources` footers.

Author skills to Anthropic's spec
(<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>):
metadata always loaded, body loaded on trigger, references loaded as
needed.
