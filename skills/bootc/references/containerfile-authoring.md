# Containerfile authoring rules for fedora-bootc

This is the reference for what may and may not appear in the embercleave bootc Containerfile (sketched in `arch.md:349-382`). bootc images are OCI images that *also* boot a kernel and run systemd as PID 1. Most normal Containerfile syntax works; the constraints come from how bootc/ostree lay out the running system.

## Filesystem zones at runtime

bootc with composefs presents `/` as read-only. The deployment root is a chroot below `/sysroot`. Mutability splits like this:

| Path | Mutable at runtime? | Updated by `bootc upgrade`? | Notes |
|---|---|---|---|
| `/usr` | no | yes | All OS content. Put binaries, libraries, systemd units, drop-ins here. |
| `/opt` | no by default | yes | Third-party apps. State overlays available, see ostree-state-overlay. |
| `/etc` | yes | yes (3-way merge) | Local edits preserved unless they conflict. Prefer `*.d/` drop-ins. |
| `/var` | yes | **no** — VOLUME semantics | Image `/var` is unpacked on initial install only. Use `tmpfiles.d` for runtime dirs. |
| `/home` | yes | no | Treated like `/var`. |
| `/run`, `/tmp` | yes (tmpfs) | n/a | Recreated on boot; populate via `tmpfiles.d`. |

`/usr/etc` is an internal implementation detail — never write there directly.

## Rules

### DO

- `RUN dnf install -y <pkgs> && dnf clean all` — standard pattern, same as any container image.
- Drop systemd units in `/usr/lib/systemd/system/` and `RUN systemctl enable <unit>` to start them at boot.
- Use `/etc/containers/systemd/*.container`, `*.kube`, `*.volume` for Quadlets. The generator runs at boot and emits transient systemd units.
- Use `tmpfiles.d` (`/etc/tmpfiles.d/` or `/usr/lib/tmpfiles.d/`) to declare runtime-needed directories with correct ownership. embercleave already does this for `/run/pi-swarm/` (arch.md:377-378).
- Put data that is read-only at runtime under `/usr/share/...` (e.g., move things some packages place in `/var/www` to `/usr/share/www` and bind-mount or symlink).
- Run `bootc container lint` as the final `RUN` step. As of bootc 1.1.6+ it warns about missing tmpfiles.d entries, bad `/var` content, and similar.
- Use `loginctl enable-linger <user>` during build for any user whose user-mode systemd needs to start at boot without a login. embercleave does this for `swarm` (arch.md:381).
- For embedded container images the host needs offline, build them as a tarball and `COPY` + `podman load` (arch.md:369-370).

### DON'T

- Do not `RUN podman pull <image>` inside the Containerfile. Nesting OCI containers during build causes whiteout-file conflicts. Use `podman load` of a tarball instead.
- Do not place writable runtime data in the image's `/var`. It will be unpacked once on first install and then frozen across upgrades. Use `tmpfiles.d` to declare directories at boot.
- Do not edit `/etc/passwd`, `/etc/shadow` post-install via runbook. Run `useradd` at build time and leave the user image-defined.
- Do not modify shipped distro config files in `/etc` directly. Use drop-in directories (`/etc/sudoers.d/`, `/etc/systemd/system/<svc>.d/`, `/etc/profile.d/`).
- Do not assume `/usr/local` content survives a derive build with composefs unless `/usr/local` stays a regular directory (don't symlink it).
- Do not bake secrets into the image. embercleave uses podman-secret per arch.md §2.

## machine-id

bootc-derived systems regenerate `/etc/machine-id` on first boot if missing. Do not pre-populate it in the image, and do not rely on a stable machine-id for anything baked into the image.

## Multi-stage builds

Multi-stage is supported and recommended for anything that needs build-time tooling not desired in the final image. The final stage must produce a valid bootc image — kernel under `/usr/lib/modules/$kver/vmlinuz`, `CMD ["/sbin/init"]`, the `containers.bootc` label, etc. When using `quay.io/fedora/fedora-bootc:latest` as the final `FROM`, all of that is inherited.

## Useful labels and metadata

The fedora-bootc base image already sets:

- `LABEL containers.bootc=1`
- `ENV container=oci`
- `STOPSIGNAL SIGRTMIN+3`
- `CMD ["/sbin/init"]`

Don't override these unless you know why.

## URLs

- Filesystem layout: https://bootc.dev/bootc/filesystem.html
- Building derived images: https://bootc.dev/bootc/building/
- Red Hat best practices: https://developers.redhat.com/articles/2025/02/26/best-practices-building-bootable-containers
- ostree /var handling: https://ostreedev.github.io/ostree/var/
- Fedora base image source: https://gitlab.com/fedora/bootc/base-images
- Fedora bootc Containerfile examples: https://docs.fedoraproject.org/en-US/bootc/
