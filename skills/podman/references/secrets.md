# Podman secrets in embercleave

arch.md:77 mandates that secrets are managed via `podman secret`, never baked
into the image. This file covers the lifecycle and the Quadlet integration.

## Why not env files

The legacy pattern — an `.env` file referenced from `EnvironmentFile=` — has
three failure modes that bit teams before Podman shipped first-class secrets:

1. The value lands in the process environment, which means it shows up in
   `podman inspect`, `ps -E`, and any crash dump.
2. Rotating the value requires editing a file the container already opened;
   the container keeps reading the old file descriptor until restart.
3. The file lives on disk somewhere the bootc image-managed layout doesn't
   know about, defeating the "image is the source of truth" invariant from
   Layer 1.

`podman secret` solves all three: secrets mount into a tmpfs at
`/run/secrets/<target>`, never enter the environment by default, and are
rotated atomically with `--replace`.

## CLI lifecycle

```
podman secret create <name> <file|->
podman secret create --replace <name> <file|->
podman secret ls
podman secret inspect <name>      # metadata only — never the value
podman secret exists <name>       # exit code, no output
podman secret rm <name>
```

To create from a string without a temp file:

```
printf '%s' "$TOKEN" | podman secret create worker-anthropic-key -
```

To create from an environment variable:

```
podman secret create --env worker-anthropic-key ANTHROPIC_API_KEY
```

Source: <https://docs.podman.io/en/latest/markdown/podman-secret-create.1.html>

## Storage

Rootless secrets live under `$XDG_DATA_HOME/containers/storage/secrets/`
(typically `~/.local/share/containers/storage/secrets/`). The default driver
is `file`, which means the value is stored read-protected (mode 0600) on disk
under the swarm user. The `pass` driver (GPG-encrypted) and `shell` driver
(custom script) exist but aren't used in embercleave — the file driver is
sufficient because the bootc host already protects `/var` per its image
policy.

Maximum size: **512 KiB**. Anthropic API keys, GitHub tokens, etc. are well
under this; do not abuse `podman secret` for blobs.

## Quadlet `Secret=` directive

In `pi-worker@.container`:

```ini
[Container]
Image=localhost/pi-worker:latest
Secret=worker-anthropic-key,type=mount,target=anthropic-key,uid=1000,gid=1000,mode=0400
Secret=worker-github-token,type=mount,target=github-token,mode=0400
```

Options on `Secret=`:

- `type=mount` — secret appears as a file (default; what we want).
- `type=env` — secret appears as an env var. **Avoid in embercleave**; defeats
  the point.
- `target=<path-or-name>` — for mount: filename under `/run/secrets/`. Without
  a leading `/`, it's relative; with a leading `/`, it's an absolute path.
- `uid=`, `gid=`, `mode=` — ownership and permissions of the mounted file.
  Use `0400` so only the worker process can read it.

Reference: <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>

The directive is "equivalent to the Podman `--secret` option", so the same
semantics apply when debugging with `podman run --secret ...` outside the
Quadlet.

## Worker code pattern

Workers read the secret file once at startup and hold the value in memory:

```ts
import { readFileSync } from "node:fs";

const anthropicKey = readFileSync("/run/secrets/anthropic-key", "utf8").trim();
```

Do **not** re-read on every request — the tmpfs is fine but the discipline of
"load once at boot" matches how the rest of the worker treats configuration.

## Rotation

```
printf '%s' "$NEW_TOKEN" | podman secret create --replace worker-anthropic-key -
systemctl --user restart pi-worker@01.service
```

Per the docs, `--replace` "updates an existing secret without affecting
already-running containers; only newly created ones use the updated value."
The restart is mandatory — the running container keeps the old mount.

In practice, rotation is driven by the `pi-rc` server (arch.md:495) running
its own Quadlet, so a rotation command becomes: write the new secret, then
ask the manager to issue a rolling restart of the affected workers via the
existing lifecycle bus.

## What does **not** work

- `podman commit` and `podman save` deliberately drop secrets — they are not
  part of the image. This is good (no key leakage in the bootc tarball) but
  means secrets must exist on the target host before any Quadlet using them
  starts. First-boot bootstrap creates them.
- Secrets are **per-user**. Rootful and rootless secret stores are separate.
  Since embercleave is rootless-only, there's only one store and it's the
  swarm user's.

## Sources

- <https://docs.podman.io/en/latest/markdown/podman-secret.1.html>
- <https://docs.podman.io/en/latest/markdown/podman-secret-create.1.html>
- <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
