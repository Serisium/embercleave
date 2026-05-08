## Project: embercleave

A hardened, image-based fedora-bootc host that runs a swarm of `pi` coding
agents under Quadlet-managed rootless Podman. All swarm functionality is
implemented as four TypeScript pi extensions (`pi-swarm-protocol`,
`pi-swarm-worker`, `pi-swarm-manager`, `pi-swarm-quadlet`) talking over a
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

Load when: editing `pi-worker@.container`, `pi-mgr.container`, or
`pi-swarm.target`; creating drop-ins under `*.container.d/`; reasoning about
template instances; deciding whether `daemon-reload` is required; mapping
`podman run` flags to `[Container]` keys; hitting Podman issue #25902
(templated `.volume` cross-ref) or #17662 (`DefaultInstance=` ignored).

References: `unit-types.md`, `template-units.md`, `dropins.md`,
`key-mapping.md`.

### [`systemd-units`](skills/systemd-units/SKILL.md) — Layer 2 supervision (lifecycle)

Load when: writing or editing user units / `pi-swarm.target` /
`/etc/tmpfiles.d/pi-swarm.conf`; implementing `swarm_logs` (journald) or
`swarm_list` (unit enumeration); picking `After=`/`PartOf=`/`BindsTo=`;
tuning `Restart=` for crash recovery; explaining `loginctl enable-linger`;
debugging a user unit that did not come up at boot.

References: `user-units.md`, `templates-and-specifiers.md`, `tmpfiles.md`,
`journald.md`, `ordering.md`.

### [`pi-coding-agent`](skills/pi-coding-agent/SKILL.md) — Layers 3 & 4

Load when: authoring or modifying any of the four `pi-swarm-*` extensions;
registering pi tools (`pi.registerTool`); hooking lifecycle events
(`session_start`, `before_agent_start`, `turn_start`, `tool_*`, `agent_end`,
`session_shutdown`); calling `pi.sendUserMessage` to inject prompts;
rendering UI widgets via `ctx.ui.setWidget`; working with pi sessions
(`--no-session`, `--continue`, `.pi/agent/sessions/`); driving pi
externally via `--mode rpc`; wiring `PI_SWARM_AGENT_ID` into a worker.

This skill explicitly flags places where the documented pi API diverges
from arch.md's assumptions (e.g. `before_turn` is actually
`before_agent_start`; `thinking`/`idle`/`tool:<name>` are derived from
`agent_start`/`agent_end`/`tool_execution_*`, not single events). Verify
against `badlogic/pi-mono` before merging.

References: `extension-api.md`, `cli-flags.md`, `rpc-mode.md`, `sessions.md`.

### [`typebox`](skills/typebox/SKILL.md) — wire schema for `pi-swarm-protocol`

Load when: defining or modifying the `BusMessage` discriminated union or
its variants (`worker_hello`, `agent_status`, `subscribe`, `publish`,
`topic_message`, `snippet_push`, `steer`, `handoff_request`); adding a new
message kind; deriving TS types via `Static<typeof T>`; validating incoming
JSONL on the bus receive loop; choosing between `Value.Check` /
`Value.Decode` / `Value.Parse` / `TypeCompiler.Compile`; encoding the
protocol-version constant or the major-version mismatch check.

References: `builders.md`, `validation.md`, `compiler.md`,
`discriminated-unions.md`.

### [`remotecompose`](skills/remotecompose/SKILL.md) — DEFERRED v2

Load **only** when the user explicitly mentions RemoteCompose, RC, the
`.rc` document format, the `pi-rc-server.container` bridge, or the
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

## Adding a new skill

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

Author skills to Anthropic's spec
(<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>):
metadata always loaded, body loaded on trigger, references loaded as
needed.
