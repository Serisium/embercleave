# Image management for the bootc base

The bootc Containerfile (arch.md:370) embeds the worker image into the host
image so that first boot needs no registry. This file covers the
`podman load` pattern, the `containers-storage:` transport, and how Quadlet
finds the embedded image.

## The pattern

From arch.md:370:

```dockerfile
COPY pi-worker.tar /var/lib/containers/storage-import/
RUN podman load -i /var/lib/containers/storage-import/pi-worker.tar
```

What this does:

1. CI builds `pi-worker:latest` from its own (separate) Containerfile.
2. CI runs `podman save --format oci-archive -o pi-worker.tar
   pi-worker:latest` to produce a portable archive.
3. The bootc image build copies that tarball into the build root.
4. `podman load` (running during `RUN`) imports it into the
   *image-time* container store, which becomes part of the bootc image
   layer.
5. At deploy time, the host's `swarm` user gets that image visible via the
   `containers-storage:` transport without ever talking to a registry.

## `podman load`

```
podman load -i <file>
podman load -i https://example.com/archive.tar
```

Source: <https://docs.podman.io/en/latest/markdown/podman-load.1.html>

Accepted formats:

- `docker-archive` (`podman save` default, also Docker's format)
- `oci-archive` (`podman save --format oci-archive`)
- `docker-dir` and `oci-dir` directories
- Compressed variants (.tar.gz, .tar.bz2, .tar.xz)

embercleave standardizes on **`oci-archive`** — it's the open standard, plays
nicely with future tooling (skopeo, registries, sigstore), and is what
fedora-bootc tooling already speaks.

`podman load` is **not** the same as `podman pull`:

- `pull` goes to a registry over HTTPS.
- `load` reads a local or remote tarball with parent-layer information
  preserved.

For a fully offline first boot, `load` is the only option.

## `containers-storage:` transport

Once an image is in local storage, it's addressable via the
`containers-storage:` transport. Quadlet's `Image=` directive resolves names
through this transport before falling back to a registry pull, which is why
the embercleave template uses:

```ini
[Container]
Image=localhost/pi-worker:latest
```

The `localhost/` prefix tells Podman "this is not a registry name, look in
local storage." Combined with the `podman load` in the Containerfile, this
guarantees no registry traffic at boot. If the image were tagged
`docker.io/embercleave/pi-worker:latest` instead, Podman might attempt a
pull on cache miss; using `localhost/` forecloses that.

To verify on a running host:

```
podman images localhost/pi-worker
podman image inspect localhost/pi-worker:latest
```

## CI build flow

```
# Build the worker
podman build -t pi-worker:latest -f Containerfile.worker .

# Tag for the bootc base
podman tag pi-worker:latest localhost/pi-worker:latest

# Save as OCI archive
podman save --format oci-archive -o pi-worker.tar localhost/pi-worker:latest

# Build the bootc base, which COPYs and loads pi-worker.tar
podman build -t embercleave-host:latest -f Containerfile.bootc .
```

The tag must match exactly what the Quadlet `Image=` line expects.
`localhost/pi-worker:latest` is the convention; mismatched tags result in
"image not found" at first systemd-generator run.

## Where the storage import lives

`/var/lib/containers/storage-import/` is **not** the runtime storage path —
it's a staging area used by image-mode Fedora's bootc tooling to seed the
read-only base. At runtime, rootless storage lives under the user home
(`~/.local/share/containers/storage/`); rootful runtime storage lives under
`/var/lib/containers/storage/`.

embercleave's worker is loaded into the **rootful** image-time store inside
the build, but at runtime it's served from there read-only via the
[additional image stores] mechanism — the rootless user can read images from
the system store without copying. This is configured in
`/etc/containers/storage.conf` via `additionalimagestores =
["/var/lib/containers/storage"]`. fedora-bootc's defaults set this for you.

[additional image stores]: https://docs.podman.io/en/latest/markdown/podman.1.html

This is why a single `podman load` at image-build time is enough for the
rootless `swarm` user at runtime: no per-user copy, no first-boot pull.

## Updating the worker

Two paths:

1. **In-place (dev only):** rebuild and `podman load` on the host. Survives
   until the next bootc deployment, which will replace the image-time store.
2. **Production:** rebuild the bootc image with a new `pi-worker.tar`, push
   the new bootc image, run `bootc switch` / `bootc upgrade`. The old worker
   image is replaced atomically with the host upgrade. This matches the
   "image is the source of truth" property of Layer 1 (arch.md:67-77).

Do not push images to a registry and have workers pull at runtime. That
breaks the offline-first property and adds a network dependency to spawn.

## Inspecting an embedded image

```
podman inspect localhost/pi-worker:latest
podman image tree localhost/pi-worker:latest
podman history localhost/pi-worker:latest
```

`history` confirms the worker layer matches what CI built — useful for
verifying that a deployed bootc host has the expected worker version.

## Sources

- <https://docs.podman.io/en/latest/markdown/podman-load.1.html>
- <https://docs.podman.io/en/latest/markdown/podman-save.1.html>
- <https://docs.podman.io/en/latest/markdown/containers-storage.5.html>
- <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
