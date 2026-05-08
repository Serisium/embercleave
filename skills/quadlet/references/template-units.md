# Template units in Quadlet

A template Quadlet is a file whose stem ends with `@`: `pi-worker@.container`. It cannot be started directly. Instead, you start instances of it: `systemctl start pi-worker@alpha.service`. The string `alpha` is the **instance name** and is exposed inside the unit via systemd specifiers.

This is plain systemd template-unit semantics; Quadlet just runs it through the generator first.

## The generator output

Given `pi-worker@.container` in `/etc/containers/systemd/`, the generator produces a templated `.service` at `/run/systemd/generator/pi-worker@.service`. systemd then instantiates `pi-worker@<id>.service` on demand. The generator path is `/usr/lib/systemd/system-generators/podman-system-generator` (system, rootful) or `/usr/lib/systemd/user-generators/podman-user-generator` (user, rootless).

You do **not** create one `.container` file per instance. One template, many instances.

## Specifiers

systemd specifiers are substituted at unit-start time, not at generator time (so the same generated `pi-worker@.service` template works for every instance). Quadlet preserves them.

| Specifier | Meaning | Example for `pi-worker@alpha.service` |
|-----------|---------|----------------------------------------|
| `%i` | Instance name (escaped) | `alpha` |
| `%I` | Instance name (unescaped — restored from systemd's escape encoding) | `alpha` (same when no special chars) |
| `%n` | Full unit name | `pi-worker@alpha.service` |
| `%N` | Unit name without the `.service` suffix | `pi-worker@alpha` |
| `%p` | Prefix (everything before `@`) | `pi-worker` |
| `%h` | User home directory | `/home/swarm` (rootless) or `/root` (rootful) |
| `%t` | Runtime directory | `/run/user/$UID` (rootless) or `/run` (rootful) |
| `%U` | User UID | `1000` |
| `%u` | User name | `swarm` |

In `pi-worker@.container` you'll see `%i` for the agentId and `%h` for resolving the user's config and workspace roots.

**Quirk:** Quadlet does not resolve relative paths that start with `%`. To use a specifier in a relative path, prepend `./` (e.g., `EnvironmentFile=./%n/env`, not `EnvironmentFile=%n/env`). For absolute paths like `%h/...` this isn't an issue.

## Instance lifecycle

1. Manager validates `agentId` against `^[a-z0-9-]+$` (arch.md:225).
2. Manager writes per-instance state: `~/.config/pi-swarm/instances/<id>.env` and `~/pi-swarm/workspaces/<id>/`.
3. Manager runs `systemctl --user start pi-worker@<id>.service`.
4. systemd notices it has no instantiated unit for this instance, looks up the template `pi-worker@.service`, instantiates it with `%i=<id>`, and starts it.
5. Quadlet-generated `[Service] ExecStart=` runs `podman run` with all `[Container]` keys translated to flags.
6. On `systemctl stop`, the same path runs `podman stop` / `podman rm`.

**No `daemon-reload` needed for steps 3-6** — the template is already loaded; only its instantiation is new (arch.md:228).

## `[Install] DefaultInstance=` (don't use it)

In stock systemd, `DefaultInstance=` in a template's `[Install]` section is the instance enabled when you `systemctl enable foo@.service` without specifying an instance. Quadlet **silently ignores it** — Podman issue #17662, closed as not-planned. The generated symlink is `foo@.service` (no instance) and never auto-starts.

The pi-worker template deliberately omits `DefaultInstance=` (arch.md:300). Workers are started imperatively by the manager.

## Issue #25902: templated `.volume` cross-reference is broken

You might be tempted to pair a templated container with a templated volume:

```ini
# foo@.container
[Container]
Volume=foo@%i.volume:/data:Z
```

```ini
# foo@.volume
[Volume]
```

This **does not work** in current Podman:

- The generator emits `foo@-volume.service` (template stem mangled) instead of `foo-volume@.service`.
- Quadlet errors with `requested Quadlet source foo@%i.volume was not found` because the cross-reference resolver doesn't substitute `%i` when looking up sibling Quadlet units.

Issue is closed/stale with no fix planned.

**Workarounds:**

1. **Bind-mount host paths** (what the pi swarm does). `Volume=%h/pi-swarm/workspaces/%i:/workspace` — no `.volume` unit, no cross-reference, no bug. The host path is a normal directory the manager creates with `mkdir -p` before starting the instance.
2. **Imperatively create a named volume** before `systemctl start`. The manager runs `podman volume create pi-worker-<id>` then references it as a literal name (`Volume=pi-worker-%i:/data` — note: literal volume name, not a `.volume` Quadlet reference). Adds cleanup burden (`podman volume rm` on stop).
3. **One `.volume` per instance, not templated.** Ship `foo-alpha.volume`, `foo-beta.volume` as concrete files. Defeats the point of templating; only viable when the instance set is small and known at image build time.

For embercleave, option 1 is canonical (arch.md:323).

## Sources

- `podman-systemd.unit(5)`: <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
- systemd specifiers (`systemd.unit(5)`): <https://www.freedesktop.org/software/systemd/man/systemd.unit.html#Specifiers>
- Issue #25902 (templated volume cross-ref): <https://github.com/containers/podman/issues/25902>
- Issue #17662 (DefaultInstance ignored): <https://github.com/containers/podman/issues/17662>
