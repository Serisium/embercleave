# Rootless Podman in embercleave

Layer 2 (arch.md:67) runs Podman entirely rootless. All worker and manager
containers run as the unprivileged `swarm` user; isolation between workers is
container-level, not user-level (arch.md:121-124). This file covers the
mechanics that make that work and the pitfalls specific to a fedora-bootc
target.

## Why rootless

Per upstream: "Containers created by a non-root user are not visible to other
users and are not seen or managed by Podman running as root."
(<https://docs.podman.io/en/latest/markdown/podman.1.html>)

For embercleave the practical wins:

- A worker compromise cannot escalate to root on the host without a separate
  kernel exploit; the rootless user namespace remaps every UID inside the
  container to a non-root subordinate UID outside.
- No daemon. Each `podman` invocation is a self-contained process; there's
  nothing to RCE that's already running as root.
- bootc / image-mode Fedora is happy with rootless because the writable state
  lives in `~/.local/share/containers/storage/` — under the user home, not
  under `/var/lib/containers` which is image-managed.

## subuid / subgid

Rootless mode requires a range of subordinate UIDs and GIDs in `/etc/subuid`
and `/etc/subgid`. Per the docs:

> When podman runs in rootless mode, a user namespace is automatically
> created for the user, defined in `/etc/subuid` and `/etc/subgid`.

For the bootc image, the simplest approach is to pre-populate those files at
image build time:

```
RUN echo 'swarm:100000:65536' >> /etc/subuid && \
    echo 'swarm:100000:65536' >> /etc/subgid
```

Or, equivalently, with the `usermod` helper (works at runtime too):

```
sudo usermod --add-subuids 100000-165535 swarm
sudo usermod --add-subgids 100000-165535 swarm
```

**Critical warning** from the upstream docs: "Whitespace in any row of
`/etc/subuid` or `/etc/subgid`, including trailing blanks, may result in no
entry failures." If `podman run` reports `newuidmap: Target UID range is
empty`, check the file with `cat -A`.

The 65536 size is the practical minimum. A worker container that runs Node as
UID 1000 inside maps to subuid 100999 outside; if the range is too small,
`useradd` inside the container fails.

## User namespaces

Rootless containers use a user namespace to map the rootless user into a
"root-like" identity inside the container. The mapping uses
`/usr/bin/newuidmap` and `/usr/bin/newgidmap`, both of which need their
`cap_setuid` / `cap_setgid` file capabilities intact. On a stock fedora-bootc
they are; if a security policy strips file capabilities, rootless breaks.

Verify mapping for a running container:

```
podman top <name> huser user
```

## Storage driver

The default rootless driver is **`overlay`** on kernel 5.12.9+ (every modern
fedora-bootc qualifies). Older kernels fall back to `fuse-overlayfs`, which
is slower and has different semantics — embercleave assumes native overlay.

Verify:

```
podman info --format '{{.Store.GraphDriverName}}'
```

If this returns `vfs`, something is misconfigured (no userns, missing kernel
support, or storage on NFS — see below).

## Storage location

Rootless images and layers live under `XDG_DATA_HOME` or the default
`~/.local/share/containers/storage/`. The bootc image itself is read-only;
this writable area is on the host's persistent partition (`/var/home/swarm`)
which Fedora bootc maps as the user home.

`podman info --format '{{.Store.GraphRoot}}'` confirms the path.

## Common pitfalls

### `permission denied` on bind mounts

Rootless containers can only read host paths the unprivileged `swarm` user
can read. The Quadlet template's workspace bind (arch.md:271, 323) targets
paths owned by `swarm`. If a path is root-owned, the container sees it as
nobody:nobody (because it's outside the userns mapping) and writes fail.

Fix: ensure host paths are `chown swarm:swarm` before the worker starts.

### NFS / network filesystems

Per upstream: "NFS and other distributed file systems are not supported when
running in rootless mode as these file systems do not understand user
namespace." Don't put `~/.local/share/containers/` on NFS. fedora-bootc puts
`/var/home` on a local btrfs/xfs by default, which is fine.

### `newuidmap: write to uid_map failed: Operation not permitted`

Almost always a missing or zero-length `/etc/subuid` / `/etc/subgid` entry
for `swarm`. Double-check with `grep ^swarm: /etc/sub{uid,gid}`.

### `cannot find newuidmap`

`shadow-utils` is missing. The fedora-bootc base includes it, but a stripped
custom base might not. Don't strip it.

### Storage corrupted across host UID changes

If the host UID of `swarm` ever changes (don't), run `podman system migrate`
to fix up the user namespace mappings on existing layers.

## What rootless does not protect against

arch.md:30 spells this out: rootless Podman + Quadlet is "not strong
sandboxing." Specifically:

- A worker that escapes the container still has whatever Linux access the
  `swarm` user has on the host — including `~/.local/share/containers/` and
  `/run/user/1000/`. That's why arch.md:20 puts the authority boundary at
  "workers cannot drive Podman or systemd," not at "workers cannot affect the
  host at all."
- Kernel-level confinement (seccomp, SELinux) layers on top via Podman's
  default profiles. The bootc base ships SELinux in enforcing mode; do not
  disable it.

## Sources

- <https://docs.podman.io/en/latest/markdown/podman.1.html>
- <https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md>
- `man 7 podman-rootless` (on a Podman host)
