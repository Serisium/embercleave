# Pi Swarm Bootc Image — Architecture

**Status:** Draft v0.1
**Scope:** Architecture and component decomposition for a hardened, image-based
host that runs a swarm of `pi` coding agents under Quadlet-managed Podman, with
agent-facing controls implemented as `pi` extensions.
**Out of scope (deferred):** RemoteCompose UI server. Tracked separately.

---

## 1. Goals and non-goals

### Goals

- A reproducible, image-based host (fedora-bootc) that boots into a fully
  configured environment for spawning and managing a swarm of `pi` instances.
- A small, well-bounded TypeScript extension surface installed inside every
  `pi` instance, providing inter-agent messaging, snippet injection, hand-off,
  and (manager-side) Quadlet-driven worker lifecycle.
- Clear authority boundaries: workers cannot drive Podman or systemd; only
  the manager can.
- Identity, status, and steering of workers expressible as tool calls the
  manager's own LLM can make in natural language.

### Non-goals (for v1)

- A separate UI service. The manager `pi` instance is the UI; its terminal
  session is the control plane.
- Multi-host federation. Single bootc host. No cross-host bus.
- Strong sandboxing beyond what rootless Podman + Quadlet provides.
  Hardening is delegated to the bootc layer and the host's egress policy.
- RemoteCompose binary streaming. Architecturally accommodated (see §10) but
  not built.

### Explicit deferrals (decisions punted, not closed)

- Authentication on the bus socket. Currently relies on filesystem permissions
  on `/run/embercleave/bus.sock`. Token-based auth is required before any
  multi-host or untrusted-worker scenario.
- Snippet store transport. v1 ships content inline over the bus; v2 should
  introduce a content-addressed store with an HTTP fetch endpoint.
- Worker isolation policy. v1 trusts all workers equally. Per-worker egress
  policy via `service-gator` or MCP Gateway is on the roadmap but not v1.

---

## 2. Layered model

The system has four layers. Each layer is replaceable without touching the
ones above or below it.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Agent-facing extensions (TypeScript, in pi)       │
│  - @serisium/embercleave-protocol (types only)                       │
│  - @serisium/embercleave-worker  (every pi instance)                 │
│  - @serisium/embercleave-manager (manager pi only)                   │
│  - @serisium/embercleave-quadlet (manager pi only)                   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Pi runtime                                        │
│  - Node.js + @mariozechner/pi-coding-agent                  │
│  - Sessions, extension loader, model providers              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Container runtime + supervision                   │
│  - Rootless Podman                                          │
│  - Quadlet-generated systemd units                          │
│  - One template (`embercleave-worker@.container`)           │
│    instantiated per worker; one static manager unit         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Hardened OS image                                 │
│  - fedora-bootc base                                        │
│  - Read-only root, transactional updates via `bootc upgrade`│
│  - Dedicated unprivileged user (`swarm`) owning all state   │
│  - Secrets via podman-secret, not baked into image          │
└─────────────────────────────────────────────────────────────┘
```

The dividing principle is **what each layer is allowed to assume about the
layers below it**:

- Layer 4 assumes pi exists and provides the documented Extension API.
- Layer 3 assumes a Linux user with a writable home and a Podman socket.
- Layer 2 assumes a working systemd, rootless Podman, and the Quadlet generator.
- Layer 1 assumes hardware. Updates by image swap, not in-place mutation.

---

## 3. Process topology

At steady state, on a running bootc host:

```
                    ┌────────────────────────────┐
                    │  manager pi                │
                    │  (host systemd:            │
                    │   embercleave-mgr.service) │
                    │                            │
                    │  + @serisium/embercleave-worker     │
                    │  + @serisium/embercleave-manager    │
                    │  + @serisium/embercleave-quadlet    │
                    │                            │
                    │  Bus server (UDS)          │
                    └──────────────┬─────────────┘
                                   │ /run/embercleave/bus.sock
               ┌───────────────────┼───────────────────┐
               │                   │                   │
      ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
      │ embercleave-    │ │ embercleave-    │ │ embercleave-    │
      │   worker@alice  │ │   worker@bob    │ │   worker@charlie│
      │                 │ │                 │ │                 │
      │ + worker ext    │ │ + worker ext    │ │ + worker ext    │
      └─────────────────┘ └─────────────────┘ └─────────────────┘
```

- The manager pi runs both worker and manager extensions, so it shows up on
  its own bus as a worker named `manager`. This is intentional: it makes the
  manager addressable for snippet injection and steering by other tools, and
  it lets us test the bus end-to-end without a separate worker.
- Workers run the worker extension only, in containers built from the
  embedded `embercleave-worker:latest` image. They have no Podman socket
  access and no write permission to `~/.config/containers/systemd/`.
- The manager runs on the host directly (not in a container) so the
  `@serisium/embercleave-quadlet` package can issue `systemctl --user`
  calls and write per-instance env files under `~/.config/embercleave/`.
  Containerizing the manager would force a Podman-socket pass-through
  that buys nothing — see §8 for the security trade-off.
- All processes run as the same unprivileged Linux user (`swarm`); isolation
  between workers is via Podman containers, not Linux users.

---

## 4. Component specification

### 4.1 `@serisium/embercleave-protocol` (npm package, types-only)

**Responsibility:** Single source of truth for bus message types and Typebox
schemas. No runtime behavior.

**Exports:**

- `BusMessage` — discriminated union of all messages traversing the bus.
- `WorkerHello`, `AgentStatus`, `Publish`, `TopicMessage`, `SnippetPush`,
  `Steer`, `HandoffRequest`, `Subscribe` — individual message variants.
- Typebox schemas for runtime validation on receive.
- Protocol version constant. Bus rejects connections from mismatched
  major versions.

**Versioning:** SemVer. Manager and workers must agree on major version.
Workers send their protocol version in `worker_hello`; manager closes the
connection on mismatch.

### 4.2 `@serisium/embercleave-worker` (npm package, pi extension)

**Installed in:** every `pi` instance, including the manager.

**Responsibilities:**

- Connect to `/run/embercleave/bus.sock` on `session_start`. Reconnect on EOF
  with backoff (250ms, 500ms, 1s, 2s, capped).
- Send `worker_hello` on connect, including `agentId` (from
  `$EMBERCLEAVE_AGENT_ID`, defaulting to `embercleave-${pid}`), cwd, and protocol version.
- Forward pi lifecycle events to the bus as `agent_status` messages.
  Map `agent_start` → `thinking`, `agent_end` → `idle`,
  `tool_execution_start` → `tool:<toolName>`. The wire-level status names
  are part of the protocol; how the worker derives them is implementation
  detail.
- Buffer `snippet_push` messages and inject them as synthetic user messages
  on the next `before_agent_start` event (the documented pi turn-start
  hook), wrapped in a `<context-snippet>` tag so the model can recognize
  the boundary.
- Handle `steer` messages by calling `pi.sendUserMessage(...)`.
- Register tools the worker's LLM can call:
  - `swarm_publish(topic, payload)` — publish to a topic.
  - `swarm_subscribe(topic)` — subscribe to a topic; subsequent messages on
    that topic become tool-result-style notifications visible to the model.
  - `swarm_request_handoff(reason, context)` — escalate to the manager.

**State:** in-memory only. Session-scoped. Clears on `session_shutdown`.

**Failure mode:** if the bus is unreachable, all `swarm_*` tool calls return
an error string explaining the bus is down. The agent continues to function;
it just can't talk to siblings.

### 4.3 `@serisium/embercleave-manager` (npm package, pi extension)

**Installed in:** manager `pi` only.

**Responsibilities:**

- Bind the bus Unix domain socket at `/run/embercleave/bus.sock` on
  `session_start`. Refuse to start if the socket is already bound (another
  manager is running; fail loudly).
- Maintain in-memory registry of connected workers: agentId, status, cwd,
  topics subscribed, last-seen timestamp.
- Route topic publish/subscribe between workers.
- Surface `handoff_request` messages to the manager's own pi session via
  `pi.sendUserMessage(...)` so the manager's LLM sees them in the
  conversation as if a human had typed them.
- Render a status widget above the editor showing connected workers and
  their states. Update on every status change.
- Register manager tools (callable by the manager's own LLM):
  - `swarm_list()` — JSON list of workers.
  - `swarm_send_snippet(agentId, snippetId, content)` — push a snippet to a
    specific worker.
  - `swarm_steer(agentId, message)` — send a user message into a worker.
  - `swarm_logs(agentId, lines=100)` — read the worker's journald output.
  - `swarm_inspect(agentId)` — `podman inspect` summary via REST socket.

**State reconciliation on manager restart:** on bind, query
`systemctl --user list-units 'embercleave-worker@*.service'` to enumerate currently
running workers. Workers will reconnect on their own; manager treats any
running unit without a corresponding bus connection as "running but
unreachable" until reconnect arrives.

### 4.4 `@serisium/embercleave-quadlet` (npm package, pi extension)

**Installed in:** manager `pi` only.

**Responsibilities:**

- Spawn workers via the `embercleave-worker@.container` template (see §6).
- Stop workers and clean up per-instance state.
- Read worker container metadata via the Podman REST socket.

**Tools:**

- `swarm_spawn(agentId, model?, initialPrompt?)` — write per-instance env
  file, create workspace directory, `systemctl --user start
  embercleave-worker@${agentId}.service`.
- `swarm_stop(agentId, removeWorkspace?)` — `systemctl --user stop`,
  optionally rm workspace directory and env file.

**Validation:** `agentId` must match `^[a-z0-9-]+$`. This is non-negotiable —
it flows into systemd unit names, container names, and filesystem paths.
The validator (`isValidAgentId`) lives in `@serisium/embercleave-protocol` and is
imported by the worker, manager, and quadlet packages.

**No daemon-reload on spawn:** the template is loaded at boot; spawning is
purely an instance start, not a unit definition change.

---

## 5. Bus protocol

### Wire format

JSONL over a Unix domain socket. One JSON object per line, LF-terminated.
Matches pi's RPC mode conventions intentionally — same parser logic applies.

### Message kinds

| Kind                | Direction          | Purpose                                    |
|---------------------|--------------------|--------------------------------------------|
| `worker_hello`      | worker → manager   | Identify on connect                        |
| `agent_status`      | worker → manager   | State change (thinking/idle/tool)          |
| `subscribe`         | worker → manager   | Subscribe to a topic                       |
| `publish`           | worker → manager   | Publish to a topic (manager fans out)      |
| `topic_message`     | manager → worker   | Delivered topic message                    |
| `snippet_push`      | manager → worker   | Inject snippet at next turn                |
| `steer`             | manager → worker   | Send user message into worker session      |
| `handoff_request`   | worker → manager   | Worker asks manager to take over           |

### Delivery semantics

- **At-most-once.** No retries. Network is a local UDS; if delivery fails
  the bus is in trouble anyway.
- **No ordering guarantees across workers.** Per-worker order is preserved
  because each worker is a single TCP-like stream.
- **No persistence.** Manager restart loses all in-flight messages. Workers
  must be designed to tolerate this.

### Backpressure

The manager doesn't apply explicit backpressure. If a worker's socket buffer
fills, writes block in the manager's event loop. This is acceptable for v1
because messages are small (KB-scale) and rare. If it becomes a problem, the
fix is per-worker outbound queues with bounded size and oldest-drop policy.

---

## 6. Quadlet template

The single source of truth for worker container configuration.

```ini
# /etc/containers/systemd/embercleave-worker@.container
# Or: ~swarm/.config/containers/systemd/embercleave-worker@.container

[Unit]
Description=embercleave worker %i
After=embercleave.target
PartOf=embercleave.target

[Container]
ContainerName=embercleave-worker-%i
Image=localhost/embercleave-worker:latest
Environment=EMBERCLEAVE_AGENT_ID=%i
Environment=EMBERCLEAVE_SOCKET=/run/embercleave/bus.sock
EnvironmentFile=-%h/.config/embercleave/instances/%i.env
Volume=/run/embercleave/bus.sock:/run/embercleave/bus.sock
Volume=%h/embercleave/workspaces/%i:/workspace
WorkingDir=/workspace
Exec=pi --no-session

[Service]
Restart=on-failure
RestartSec=5

[Install]
# Note: DefaultInstance is intentionally omitted — Quadlet has historically
# ignored it. Instances are started imperatively by the manager.
```

### Per-instance variation

Three mechanisms, in order of preference:

1. **Environment file drop-in.** `~/.config/embercleave/instances/<id>.env`
   provides per-instance env vars. Optional (leading `-`). Manager writes it
   before starting the unit. Use this for: model selection, initial prompt,
   feature flags.
2. **Drop-in `.conf` files.** `~/.config/containers/systemd/embercleave-worker@<id>.container.d/override.conf`
   for structural changes (different image, extra volumes). Use sparingly;
   reach for it only when env vars can't express the change.
3. **A different template.** When two classes of worker are genuinely
   different (e.g., a "research" worker with browser tools vs. a "code"
   worker without), ship them as separate templates: `embercleave-worker@.container`
   and `embercleave-researcher@.container`.

### Known gotchas (not bugs to fix; constraints to design around)

- Templated `.volume` units don't cross-reference correctly from a templated
  `.container` (Podman issue #25902). Workaround: bind-mount host paths
  (as the template does), or imperatively `podman volume create
  embercleave-worker-<id>` from the manager extension before starting the unit.
- `DefaultInstance=` is ignored. Don't auto-start instances at boot from the
  template; manage start/stop imperatively.
- `daemon-reload` is only needed when the template itself changes, which
  happens at image build time, not at runtime.

---

## 7. Image composition (bootc layer)

The image build lives in [`image/`](./image). What follows is the design;
the working files (Containerfile, Quadlet template, systemd units,
tmpfiles, build/test infra) are there.

### Manager on host, workers in containers

The manager runs on the bootc host directly under swarm's user-mode
systemd, **not** in a container. It is the trusted control plane that
owns the swarm — wrapping it in a container adds an indirection without
a real isolation benefit (a manager bug compromises every worker
regardless). Workers stay containerized because they are the untrusted
blast radius — one runaway pi shouldn't be able to touch the host.

This means there is one runtime container image (`embercleave-worker:latest`),
not two, and the `[Install]` chain runs through `embercleave.target`.

### Build inputs

- `quay.io/fedora/fedora-bootc` as base, pinned by digest.
- Node.js + npm + git.
- The four `@serisium/embercleave-*` npm packages, installed globally —
  the host runs `pi` directly for the manager, so all four extensions
  must be resolvable from the host's global modules.
- A pre-built `embercleave-worker:latest` container image (worker +
  protocol + pi only), embedded in the bootc image via `podman load`
  for offline availability.
- The `embercleave-worker@.container` Quadlet template at
  `/etc/containers/systemd/` (instances activated at runtime by
  `@serisium/embercleave-quadlet`).
- An `embercleave-mgr.service` user systemd unit at `/etc/systemd/user/`
  (singleton, `ExecStart=/usr/bin/pi`, EnvironmentFile-driven).
- An `embercleave.target` user systemd unit at `/etc/systemd/user/` for
  ordered shutdown of manager + active worker instances.
- A tmpfiles.d snippet that recreates `/run/embercleave/` (mode 0750,
  owned by `swarm:swarm`) on every boot.
- `loginctl enable-linger swarm` so swarm's user-mode systemd starts at
  boot before any login.
- `systemctl --global enable embercleave.target embercleave-mgr.service`
  so both auto-start once linger is up.
- `bootc container lint` as the final `RUN` (catches missing tmpfiles.d
  entries, content under `/var`, and similar build-time mistakes).

### Containerfile sketch

```dockerfile
ARG FEDORA_BOOTC_DIGEST=sha256:...
FROM quay.io/fedora/fedora-bootc@${FEDORA_BOOTC_DIGEST}

RUN dnf install -y nodejs npm git \
 && dnf clean all \
 && useradd --create-home --shell /bin/bash swarm \
 && loginctl enable-linger swarm

RUN npm install -g \
      @mariozechner/pi-coding-agent \
      @serisium/embercleave-protocol \
      @serisium/embercleave-worker \
      @serisium/embercleave-manager \
      @serisium/embercleave-quadlet

COPY image/worker/dist/embercleave-worker.tar /var/lib/containers/storage-import/
RUN podman load -i /var/lib/containers/storage-import/embercleave-worker.tar \
 && rm /var/lib/containers/storage-import/embercleave-worker.tar

COPY image/quadlets/   /etc/containers/systemd/
COPY image/systemd/    /etc/systemd/user/
COPY image/tmpfiles.d/ /etc/tmpfiles.d/

RUN systemctl --global enable embercleave.target embercleave-mgr.service
RUN bootc container lint
```

### Runtime layout

```
/etc/containers/systemd/        (read-only, image-managed; Quadlet generator dir)
  embercleave-worker@.container

/etc/systemd/user/              (read-only, image-managed; user systemd units)
  embercleave.target
  embercleave-mgr.service

/etc/tmpfiles.d/
  embercleave.conf              (recreates /run/embercleave/ on boot)

/var/lib/containers/storage/    (image-managed; embedded OCI images)
  ...embercleave-worker:latest...

/run/embercleave/               (tmpfs, swarm:swarm 0750)
  bus.sock                      (created by manager at startup)

/home/swarm/                    (mutable, persists across `bootc upgrade`)
  .config/embercleave/manager.env
  .config/embercleave/instances/<id>.env
  embercleave/workspaces/<id>/
  .pi/agent/sessions/...
```

### Update model

`bootc upgrade` swaps the OS image. The mutable state in `/home/swarm/` is
preserved. Worker containers are stopped on shutdown and restarted from the
new image on next boot. In-flight conversations in worker pi sessions are
not preserved across image swaps unless the manager explicitly forks
sessions and resumes them — call this out as a known limitation; v1 doesn't
do graceful drain.

---

## 8. Authority model

Who can do what:

| Capability                          | Worker | Manager pi | Manager LLM (via tools) |
|-------------------------------------|--------|------------|-------------------------|
| Read its own session state          | ✓      | ✓          | ✓                       |
| Publish on bus                      | ✓      | ✓          | ✓                       |
| Subscribe to topics                 | ✓      | ✓          | ✓                       |
| Push snippet to another worker      | ✗      | ✓          | ✓                       |
| Steer another worker                | ✗      | ✓          | ✓                       |
| Spawn worker                        | ✗      | ✓          | ✓                       |
| Stop worker                         | ✗      | ✓          | ✓                       |
| Read worker logs                    | ✗      | ✓          | ✓                       |
| Modify Quadlet template             | ✗      | ✗          | ✗ (image-managed)       |
| Modify bootc image                  | ✗      | ✗          | ✗                       |

The "Manager LLM" column matters: any tool the manager extension registers
is callable by the manager's own model. This is the feature, not a bug —
it's how natural-language orchestration works. But it means a prompt
injection that reaches the manager's LLM can spawn or stop workers.

**Mitigation in v1:** the manager's pi runs as the unprivileged `swarm`
user (host-level user systemd service, not containerized — see §7). It
can start/stop sibling user units, read/write under `/home/swarm/`, and
talk to the bus socket in `/run/embercleave/`. It cannot modify the
bootc image, write to image-managed paths in `/usr` or `/etc`, execute
`bootc` operations, or affect any other user's processes — all blocked
by ordinary Linux user-mode permissions on a composefs read-only root.

The trade-off vs. a containerized manager is conscious: containerizing
would have required a Podman-socket pass-through to let the manager
issue `systemctl --user` and write per-instance env files, which
re-exposes the same surface from inside the container. Worker
containers, where the prompt-injection blast radius actually lives,
remain isolated by Podman.

**Mitigation deferred to v2:** a permission-gate pattern on the manager's
sensitive tools — `swarm_spawn` and `swarm_stop` could require human
confirmation by default, with a session flag to disable for automation runs.
Pi has prior art for this in third-party extensions.

---

## 9. Failure modes and recovery

### Manager crash

- Workers' sockets EOF. Their reconnect loop kicks in.
- systemd restarts `embercleave-mgr.service` (`Restart=on-failure`).
- Manager rebinds the socket and runs reconciliation against
  `systemctl list-units`.
- Workers reconnect, re-send `worker_hello`, manager rebuilds registry.
- In-flight bus messages are lost. Workers must not assume a `publish`
  was delivered without seeing a corresponding `topic_message` echo
  (which v1 doesn't provide — accept the loss).

### Worker crash

- Quadlet's `Restart=on-failure` brings it back.
- New process gets the same `agentId` (from `%i` in the unit), reconnects.
- Pi session state: depends on whether the worker started with `--no-session`
  (v1 default) or a session ID. With `--no-session`, the worker comes back
  fresh and the manager has to push any state it needed back in via snippets.

### Bus socket file missing

- systemd-tmpfiles recreates `/run/embercleave/` on boot.
- If something deletes the socket while running: manager will fail next
  bind on restart, exiting loudly. This is the right failure mode — manual
  intervention required.

### Manager LLM goes off the rails

- It can spawn many workers (resource exhaustion).
- It can stop workers it shouldn't (work loss).
- v1 has no soft limit on worker count. Add one in v2: `swarm_spawn` rejects
  if more than N workers are running.

---

## 10. Forward compatibility — RemoteCompose

Deferred from v1, but the architecture leaves room for it:

- The manager extension already produces structured state (worker list,
  status changes). Add a second consumer alongside the bus widget: a
  WebSocket server on a separate port that emits the same state changes
  as JSON.
- A separate Kotlin/Native (or JVM) service subscribes to that WebSocket,
  builds RemoteCompose `.rc` documents from the state, and serves them to
  RC players over its own WebSocket. The manager extension never touches
  the `.rc` format.
- This service runs as its own Quadlet (`embercleave-rc-server.container`), independent
  of the manager. Crash isolation, independent update cycle.

The decision deferred is whether the RC service authors documents from
`remote-core` (Kotlin) or from a TS port. Resolved by checking whether
`androidx.compose.remote:remote-core` publishes Native artifacts.

---

## 11. Open questions for v1

1. **Worker pi sessions: ephemeral or persistent?** Currently `--no-session`.
   Persistent sessions enable resume-after-restart but complicate cleanup
   and make `agentId` collision a real concern. Default ephemeral; allow
   opt-in via env file.

2. **Snippet store: inline or separate?** Currently inline in the bus
   message. If snippets get large (>100KB) the bus chokes. Resolution:
   add a content-addressed store as an HTTP server on the manager and a
   `snippet_ref` message kind that workers fetch on receive. Defer until
   needed.

3. **How does the human steer the manager?** Three options:
   (a) SSH in and attach to the manager's tmux session;
   (b) the manager runs in `--mode rpc` and a thin HTTP wrapper exposes it;
   (c) the manager runs a Slack/Discord bot extension.
   v1 picks (a) for simplicity. (b) and (c) are extensions that can be
   added without changing the architecture.

4. **Logging strategy.** All worker output goes to journald via Quadlet.
   `swarm_logs` reads journald. Is that good enough, or do we want
   structured logs to a file the manager can grep? Defer; journald is fine
   until it isn't.

5. **What happens at `bootc upgrade` while workers are mid-conversation?**
   Currently: workers die, restart fresh, lose context. Acceptable for v1.
   Graceful drain is a v2 feature.

---

## 12. Build order

A suggested implementation order that lets each step produce something
testable:

1. **`@serisium/embercleave-protocol`** — types and schemas. No tests beyond type
   compilation.
2. **Bus skeleton in `@serisium/embercleave-manager`** — bind the socket, log connections,
   register one no-op tool. Run a manager pi by hand and `nc -U` to it.
3. **Worker extension** — connect, hello, status events. Run a worker pi
   by hand and watch it appear in the manager's log.
4. **Topic routing** — publish/subscribe. Test with two hand-launched
   workers.
5. **Snippet injection** — `before_agent_start` hook + `swarm_send_snippet`. Test
   by pushing a snippet to a worker and watching it appear in the next
   model turn.
6. **`@serisium/embercleave-quadlet`** — `swarm_spawn` and `swarm_stop`. Test by
   spawning workers from the manager's tools and watching them connect.
7. **Manager LLM tools** — `swarm_list`, `swarm_steer`, `swarm_logs`. Now
   the manager's LLM can orchestrate.
8. **Bootc image** — Containerfile, embedded worker image, Quadlets,
   tmpfiles. Build, deploy to a VM, verify cold-boot orchestration works.

Each step is mergeable on its own and provides end-to-end testable
behavior with the previous steps.

---

## Appendix A — Glossary

- **Quadlet** — Podman's systemd integration. A `.container` file in
  `~/.config/containers/systemd/` is processed by the Quadlet generator
  into a real `.service` unit at `daemon-reload` time.
- **Bootc** — bootable container image. The base OS itself ships as a
  container; updates are image swaps, not package installs.
- **`%i` / `%I`** — systemd template specifiers for the instance name
  (after `@` in the unit name). `%i` is escaped, `%I` unescaped.
- **Pi** — `@mariozechner/pi-coding-agent`. A minimal terminal coding
  harness with TypeScript extensions, RPC mode, and an SDK.
- **RemoteCompose** — a compact binary UI/canvas format for streaming
  interactive scenes to remote players. Authored from Kotlin (AndroidX
  `compose/remote`); deferred from v1.
