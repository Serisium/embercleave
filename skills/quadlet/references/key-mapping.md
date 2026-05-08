# `[Container]` key -> `podman run` flag mapping

Quadlet translates `[Container]` keys into `podman run` flags at generator time. This reference lists the keys most relevant to the pi swarm and a few that come up when overriding via drop-ins. For exhaustive coverage, see `podman-systemd.unit(5)`.

## Core identity and image

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `Image=` | first positional argument | **Required.** Use a fully qualified reference for `AutoUpdate=registry`. `localhost/pi-worker:latest` for embercleave. |
| `ContainerName=` | `--name` | Without this, Quadlet auto-names as `systemd-<service>`. The pi-worker template sets `ContainerName=pi-worker-%i` so `podman ps` is readable. |
| `Exec=` | trailing positional args | Command + args after the image. Tokenized like a shell line; multi-line continuations supported with `\`. |
| `WorkingDir=` | `--workdir` | Set CWD inside the container. |
| `User=` | `--user` | UID or `uid:gid`. |

## Environment

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `Environment=` | `--env` | Repeatable. `Environment=KEY=value`. Accumulates across drop-ins. |
| `EnvironmentFile=` | `--env-file` | Repeatable. Prefix with `-` to make optional (no error if missing). The pi-worker template uses `EnvironmentFile=-%h/.config/pi-swarm/instances/%i.env`. |
| `Secret=` | `--secret` | Pass a Podman secret (file or env). Format: `SECRET[,opt=val,...]`. |

## Storage

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `Volume=` | `--volume` | Repeatable. Forms: `host:container[:opts]`, `volname:container[:opts]`, or `name.volume:container[:opts]` to reference a sibling `.volume` Quadlet. **Templated `.volume` references are broken (#25902)** — bind-mount instead. |
| `Mount=` | `--mount` | Repeatable. More expressive: `type=bind,source=...,destination=...`, `type=tmpfs,...`, `type=volume,source=name.volume,destination=...`. |
| `Tmpfs=` | `--tmpfs` | `CONTAINER-DIR[:OPTIONS]`. |
| `ReadOnly=` | `--read-only` | Default `false`. |

## Networking

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `Network=` | `--network` | Repeatable. Modes: `host`, `none`, `slirp4netns`, `pasta`, network name, or `name.network` Quadlet reference. |
| `PublishPort=` | `--publish` | Repeatable. `[host-ip:]host-port:container-port[/proto]`. |
| `Expose=` | `--expose` | Declare a port without publishing. |
| `IP=`, `IP6=` | `--ip`, `--ip6` | Static address assignment. |
| `HostName=` | `--hostname` | |

## Lifecycle and signals

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `Notify=` | `--sdnotify` | Default `false`. `true` enables sd_notify proxying; `healthy` delays start notification until healthcheck passes. Quadlet sets `[Service] Type=notify` automatically for `.container`. |
| `RunInit=` | `--init` | Default `false`. Adds tini-style init for proper signal forwarding. |
| `StopTimeout=` | `--stop-timeout` | Seconds before SIGKILL on stop. |
| `StopSignal=` | `--stop-signal` | Signal sent on `podman stop`. |

## Security

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `AddCapability=` | `--cap-add` | Space-separated list. |
| `DropCapability=` | `--cap-drop` | Space-separated list. `all` drops everything. |
| `NoNewPrivileges=` | `--security-opt no-new-privileges` | Default `false`. |
| `SecurityLabelDisable=`, `SecurityLabelType=`, `SecurityLabelLevel=` | `--security-opt label=...` | SELinux tuning. |
| `UserNS=` | `--userns` | `host`, `keep-id`, `auto`, `nomap`, etc. |
| `GroupAdd=` | `--group-add` | Repeatable. Supports `keep-groups`. |
| `ReadOnlyTmpfs=` | `--read-only-tmpfs` | Mount tmpfs over `/tmp`, `/run`, `/var/tmp` when `ReadOnly=true`. |

## Health and updates

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `HealthCmd=` | `--health-cmd` | Command string. `none` disables. |
| `HealthInterval=`, `HealthTimeout=`, `HealthRetries=`, `HealthStartPeriod=` | `--health-*` | |
| `AutoUpdate=` | label `io.containers.autoupdate` | `registry` (needs FQ image) or `local`. Used with `podman auto-update`. |

## Escape hatch

| Key | Podman flag | Notes |
|-----|-------------|-------|
| `PodmanArgs=` | raw flags | Space-separated args appended to the generated `podman run`. Use only when no first-class key exists; review at next Quadlet version since first-class keys keep being added. |

## How keys behave under drop-ins

- **Accumulating keys** (repeatable in `podman run`): `Volume=`, `Mount=`, `Environment=`, `EnvironmentFile=`, `Network=`, `PublishPort=`, `AddCapability=`, `DropCapability=`, `GroupAdd=`, `Secret=`, `Tmpfs=`. Drop-ins add to the source's values. To reset, set the key to empty (`Environment=`) on its own line before re-adding.
- **Single-valued keys**: `Image=`, `ContainerName=`, `User=`, `WorkingDir=`, `Exec=`, `UserNS=`, `Notify=`, etc. The last value wins.

See `dropins.md` for the directory ordering that determines "last".

## Sources

- `podman-systemd.unit(5)` (full key reference): <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
- `podman-run(1)` (flag semantics): <https://docs.podman.io/en/latest/markdown/podman-run.1.html>
