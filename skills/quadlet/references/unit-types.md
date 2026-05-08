# Quadlet unit types

Quadlet recognizes seven file extensions. Each generates a corresponding systemd `.service` (or `.target`-friendly) unit and maps to a Podman subcommand.

| Extension | Generates | Maps to | Default `Type=` | When to reach for it |
|-----------|-----------|---------|-----------------|----------------------|
| `.container` | `name.service` | `podman run` | `notify` | A long-running container. Default for everything in the pi swarm. |
| `.pod` | `name-pod.service` | `podman pod create` + member services | `forking` | Multiple containers sharing a network/IPC namespace. Not currently used in embercleave. |
| `.volume` | `name-volume.service` | `podman volume create` | `oneshot` | A named Podman volume (lifecycle managed by systemd). **Avoid templating** — see template-units.md. |
| `.network` | `name-network.service` | `podman network create` | `oneshot` | Custom Podman networks. The pi swarm uses host-path bus sockets, not custom networks. |
| `.image` | `name-image.service` | `podman pull` | `oneshot` | Pre-pull an image so a container start doesn't block on registry I/O. The bootc image bakes `pi-worker:latest` directly into containers-storage, so we don't need this. |
| `.kube` | `name.service` | `podman kube play` | `notify` | Kubernetes-style YAML deployments. Out of scope for embercleave. |
| `.build` | `name-build.service` | `podman build` | `oneshot` | Build an image from a Containerfile at unit-start time. Not used; image is built upstream. |

## Section conventions

Each unit file has a Quadlet-owned section keyed by the type:

| Extension | Quadlet section |
|-----------|-----------------|
| `.container` | `[Container]` |
| `.pod` | `[Pod]` |
| `.volume` | `[Volume]` |
| `.network` | `[Network]` |
| `.image` | `[Image]` |
| `.kube` | `[Kube]` |
| `.build` | `[Build]` |

Standard systemd sections (`[Unit]`, `[Service]`, `[Install]`) are passed through to the generated unit untouched. So `[Service] Restart=on-failure` in a `.container` ends up verbatim in the generated `.service`.

## Decision rules for embercleave

- **Worker process** -> `.container` (templated). Single source of truth at `/etc/containers/systemd/pi-worker@.container`.
- **Manager process** -> `.container` (non-templated, single instance), enabled at boot via `[Install] WantedBy=default.target`.
- **Coordinated shutdown** -> a plain systemd `.target` (not a Quadlet type), with workers using `PartOf=pi-swarm.target`. Shipped at `/etc/containers/systemd/pi-swarm.target` (Quadlet ignores non-recognized extensions; the file just lives there for organizational clarity, or place it in `/etc/systemd/system/`).
- **Per-worker storage** -> bind-mount host paths from `[Container] Volume=`, **not** a `.volume` unit. The templated-volume bug (#25902) makes templated `.volume` units unusable; bind mounts are simpler and avoid the issue entirely.
- **Per-worker network** -> reuse the host bus socket via bind mount; no `.network` unit needed.

## Sources

- `podman-systemd.unit(5)`: <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
- Arch manpage mirror: <https://man.archlinux.org/man/podman-systemd.unit.5.en>
- Red Hat overview: <https://www.redhat.com/en/blog/quadlet-podman>
