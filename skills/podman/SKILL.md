---
name: podman
description: Use this skill for Podman concerns in embercleave — rootless container runtime setup (subuid/subgid, user namespaces), enabling and querying the Podman REST API socket from the manager pi, managing credentials with `podman secret` and the Quadlet `Secret=` directive, embedding the worker image into the bootc base via `podman load` from a tarball, and reading container state with `podman inspect` for the `swarm_inspect` tool. Trigger when work involves the Podman socket, libpod API, secret lifecycle, image pre-population, or container metadata inspection.
---

# Podman in embercleave

Podman is **Layer 2** of the stack (arch.md:67) — the rootless container runtime
under which the manager pi orchestrates the worker swarm via Quadlet-generated
systemd units (arch.md:67-68). All Podman operations run as the unprivileged
`swarm` user; isolation between workers is by container, not by Linux user
(arch.md:121-124).

## Decision tree

| Task                                                    | Read                          |
| ------------------------------------------------------- | ----------------------------- |
| Enable / talk to the Podman REST socket                 | `references/rest-api.md`      |
| Create or rotate a credential the worker needs at boot  | `references/secrets.md`       |
| Diagnose `permission denied` / `newuidmap` / userns errors | `references/rootless.md`   |
| Pre-load `pi-worker.tar` into the bootc image           | `references/image-management.md` |

## Project-specific conventions

### Authority boundary (arch.md:20, 121)

The most important Podman invariant in embercleave: **workers MUST NOT have
access to the Podman socket.** The manager pi is the only process that talks
to `podman.sock`. Worker Quadlets run as the same `swarm` user but the
template grants no socket bind-mount. Reject any change that exposes the
socket to a worker — arch.md:30 defers stronger sandboxing, so the socket is
the escalation path.

### Manager → Podman over the REST socket (arch.md:199, 215)

`swarm_inspect(agentId)` and the Quadlet extension reach Podman through the
**rootless user socket** at `unix://$XDG_RUNTIME_DIR/podman/podman.sock`.
Enable it once: `systemctl --user enable --now podman.socket` plus
`loginctl enable-linger swarm` to survive logout. In Node.js use `undici`
with `connect: { socketPath }`. Use libpod endpoints (richer than the
Docker-compat layer):

```
GET /v5.0.0/libpod/containers/<name>/json
```

For `swarm_inspect` extract `State.{Status,Running,Pid,StartedAt,ExitCode,
OOMKilled}`, `RestartCount`, `Config.Image`, `Mounts[]`,
`NetworkSettings.SandboxKey`. Do not shell out to `podman inspect` from the
manager — the socket avoids fork overhead and matches what Quadlet uses.

See `references/rest-api.md` for activation, libpod vs compat, and a Node.js
client snippet.

### Secrets pattern (arch.md:77)

**Secrets via `podman secret`, not baked into the image.** Flow: on first
boot (or via `pi-rc`), `printf '%s' "$TOKEN" | podman secret create
worker-anthropic-key -`; the Quadlet references it with `Secret=
worker-anthropic-key,type=mount,target=anthropic-key,mode=0400`; the worker
reads `/run/secrets/anthropic-key` at startup. This beats `EnvironmentFile=`
because the value never enters the environment, never lands in journald, and
`--replace` rotates without editing the Quadlet. See `references/secrets.md`.

### Embedded worker image (arch.md:370)

The Containerfile bakes the worker image into the bootc layer:

```
COPY pi-worker.tar /var/lib/containers/storage-import/
RUN podman load -i /var/lib/containers/storage-import/pi-worker.tar
```

Zero registry dependency at first boot — critical for offline-first. The tar
is produced in CI by `podman save --format oci-archive`. Quadlet's
`Image=localhost/pi-worker:latest` resolves through the `containers-storage:`
transport without a pull. See `references/image-management.md`.

### What Quadlet does with Podman

Quadlet (arch.md:67, 271) is a systemd generator: at `daemon-reload` it
reads `~/.config/containers/systemd/*.container` and writes `.service` units
wrapping `podman run`. The generator runs as the user, not via the socket;
the socket only matters for the manager's runtime introspection. Key
directives in the embercleave templates: `Image=localhost/pi-worker:latest`,
`Secret=<name>,type=mount,target=...`, `Notify=true`.

## Common pitfalls

- Forgetting `loginctl enable-linger swarm` — the socket dies at logout.
- Wrong storage driver after `podman load` — confirm `overlay` with
  `podman info --format '{{.Store.GraphDriverName}}'`.
- Secret rotation without `--replace` plus a Quadlet restart leaves the old
  value in the running container.
- Bind-mounting the socket into a worker — never. Authority boundary
  (arch.md:20).
