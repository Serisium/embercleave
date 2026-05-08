---
name: quadlet
description: Author and modify Quadlet unit files (.container, .pod, .volume, .network, .image, .kube, .build) for the embercleave pi swarm. Use when editing pi-worker@.container, pi-mgr.container, or pi-swarm.target; creating drop-in overrides under .container.d/; reasoning about template instances (foo@id.service); deciding when systemctl daemon-reload is required; or mapping podman run flags to [Container] keys. Also covers Quadlet quirks (Podman issue #25902 templated-volume cross-ref bug, ignored DefaultInstance=). Quadlet is Podman's systemd integration; .container files in /etc/containers/systemd/ are processed by the podman-system-generator at daemon-reload time into transient .service units.
---

# Quadlet for the pi swarm

Quadlet is the **single source of truth** for worker container configuration in embercleave (arch.md:273). The host ships `pi-worker@.container` (templated workers), `pi-mgr.container` (manager), and `pi-swarm.target` (ordered shutdown). Everything else is per-instance variation layered on top.

## Quadlet primer

Quadlet is a systemd generator. Drop a declarative `.container` (or `.pod`, `.volume`, etc.) into a known directory; at boot and on every `daemon-reload` the generator at `/usr/lib/systemd/system-generators/podman-system-generator` (rootful) or `/usr/lib/systemd/user-generators/podman-user-generator` (rootless) emits a transient `.service` into `/run/systemd/generator/`. You then `systemctl start foo.service` like any other unit.

**Source paths.** System (rootful): `/run/containers/systemd/`, `/etc/containers/systemd/` (where embercleave ships templates), `/usr/share/containers/systemd/`. User (rootless): `$XDG_RUNTIME_DIR/containers/systemd/`, `~/.config/containers/systemd/` (user drop-ins), then `/etc/containers/systemd/users/${UID}/`, `/etc/containers/systemd/users/`, `/usr/share/containers/systemd/users/${UID}/`, `/usr/share/containers/systemd/users/`.

**Service name:** `foo.container` -> `foo.service`; `foo@.container` -> `foo@.service`, instantiated as `foo@bar.service`.

**Unit types:** `.container`, `.pod`, `.volume`, `.network`, `.image`, `.kube`, `.build`. See `references/unit-types.md`.

## The pi-worker template

Lives at `/etc/containers/systemd/pi-worker@.container` (image-managed, read-only — baked into the bootc layer at build time, arch.md:342). The full template is at arch.md:275-302. Key properties:

- Templated (`@.container`): one file, many instances. `%i` becomes `agentId`.
- `PartOf=pi-swarm.target`: `systemctl stop pi-swarm.target` cascades to every running worker.
- `EnvironmentFile=-%h/.config/pi-swarm/instances/%i.env`: leading `-` makes it optional. Primary per-instance variation channel.
- `Volume=%h/pi-swarm/workspaces/%i:/workspace`: bind-mount, deliberately not a templated `.volume` unit (see gotchas).
- No `[Install] DefaultInstance=`: workers start imperatively, never auto-enabled.

## Per-instance variation: pick the lightest tool

Three mechanisms in priority order (arch.md:304):

1. **EnvironmentFile drop-in** — `~/.config/pi-swarm/instances/<id>.env`. For anything env-var-expressible (model, initial prompt, feature flags). Manager writes it before `systemctl --user start`. No `daemon-reload`.
2. **Systemd drop-in `.conf`** — `~/.config/containers/systemd/pi-worker@<id>.container.d/override.conf`. For structural changes (extra volumes, capability tweaks). Requires `daemon-reload`. See `references/dropins.md`.
3. **Separate template** — when classes are genuinely different. Ship `pi-researcher@.container` alongside, don't overload one template with branching drop-ins.

If you keep reaching for option 2, that's a signal the template should change at the next image build.

## When daemon-reload is required

| Change | daemon-reload? |
|--------|----------------|
| Spawning a new instance of an existing template | **No** (arch.md:228) |
| Writing/updating an instance env file | No |
| Editing the `pi-worker@.container` template | Yes |
| Adding/removing a `.container.d/*.conf` drop-in | Yes |
| Adding a new `.container` / `.volume` / `.network` file | Yes |

Template edits happen at image build time. In normal swarm operation the manager extension never calls `daemon-reload`.

## Known gotchas (constraints, not bugs to fix)

1. **Templated `.volume` cross-reference is broken** (Podman #25902). A templated `.container` cannot reference a templated `.volume` like `Volume=foo@%i.volume:/data` — generator emits `foo@-volume.service` and source resolution fails. **Workaround used:** bind-mount host paths (`Volume=%h/pi-swarm/workspaces/%i:/workspace`). If a true named volume is ever needed per-instance, have the manager `podman volume create pi-worker-<id>` imperatively before `systemctl start`.
2. **`DefaultInstance=` is silently ignored** (Podman #17662, closed not-planned). Don't auto-enable instances from the template's `[Install]`. Start them imperatively.

## agentId validation

The manager **must** validate `agentId` against `^[a-z0-9-]+$` before any `systemctl` call (arch.md:225). The id flows into:

- systemd unit name: `pi-worker@<agentId>.service`
- container name: `pi-worker-<agentId>` (via `ContainerName=pi-worker-%i`)
- filesystem paths: `~/.config/pi-swarm/instances/<agentId>.env`, `~/pi-swarm/workspaces/<agentId>/`

A bad id is a unit-name injection. Reject before invoking systemctl.

## Authoring decision tree

- Knob for **all** workers? -> edit `pi-worker@.container`, rebuild image, ship.
- Knob for **one** instance? -> if env-expressible, write `<id>.env`; otherwise drop-in.
- A different **kind** of worker? -> new template (`pi-researcher@.container`), not a drop-in fork.
- Tempted to write a templated `.volume`? -> don't. Bind-mount, or `podman volume create` imperatively.
- Tempted to set `DefaultInstance=`? -> remove it; silently ignored.
- About to `daemon-reload` from the manager? -> almost certainly wrong; the template is static at runtime.

## References

- `references/unit-types.md` — `.container`, `.pod`, `.volume`, `.network`, `.image`, `.kube`, `.build`; when to use each.
- `references/template-units.md` — `@`-template semantics, `%i`/`%I`/`%h`/`%t` specifiers, instance lifecycle, full breakdown of #25902.
- `references/dropins.md` — drop-in directory layout, merge order, override quirks (#26555).
- `references/key-mapping.md` — `[Container]` keys -> `podman run` flag reference.

External: `podman-systemd.unit(5)` <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>; Red Hat intro <https://www.redhat.com/en/blog/quadlet-podman>.
