---
name: bootc
description: Reference for fedora-bootc, the Layer 1 hardened OS image for embercleave. Use when authoring or modifying the embercleave Containerfile, the /etc/containers/systemd/ Quadlet layout, tmpfiles.d, the swarm user setup, or anything to do with bootc CLI behavior (status, upgrade, switch, install, rollback) and transactional image-based updates. Also use when reasoning about what survives a bootc upgrade vs. what is wiped, what belongs in /usr vs /var vs /etc vs /home/swarm, or when debugging why something added to the Containerfile did not appear on the running host. Triggers: bootc, fedora-bootc, bootable container, bootc upgrade, bootc switch, bootc install, ostree, composefs, image-based OS, transactional update, read-only root, /etc/containers/systemd, Quadlet image, hardened host image.
---

# bootc (fedora-bootc) for embercleave

## What bootc is

bootc ships a full Linux OS as an OCI/Docker image. The container includes the kernel, systemd, userspace, and any preinstalled software. The host boots directly into it. Updates are transactional: `bootc upgrade` pulls a new image, stages it as the next boot, and on reboot the system pivots to it. The previous deployment stays on disk for `bootc rollback`. Internally bootc builds on ostree and (with composefs) presents `/` as read-only.

This is the opposite mental model from a package-managed host. You do not `dnf install` on the running machine to add software. You change the Containerfile, rebuild, push, and `bootc upgrade`. Anything written to the image-managed paths at runtime is lost on the next deployment swap.

## embercleave-specific layout

The Containerfile is sketched in `arch.md:349-382` (section "Containerfile sketch"). It is built `FROM quay.io/fedora/fedora-bootc:latest`, dnf-installs nodejs/npm/git, creates the unprivileged `swarm` user, npm-installs the four pi-swarm packages globally, `podman load`s the embedded `pi-worker.tar`, copies Quadlets into `/etc/containers/systemd/`, drops a tmpfiles.d snippet, and `loginctl enable-linger swarm`.

The runtime layout (arch.md:384-399) splits cleanly into three regions:

| Path | Lifetime | Who owns it |
|---|---|---|
| `/etc/containers/systemd/` | image-managed, read-only at runtime | bootc image |
| `/run/pi-swarm/` | tmpfs, recreated each boot via tmpfiles.d | swarm |
| `/home/swarm/` | persistent across `bootc upgrade` | swarm |

Anything that must survive an image swap goes under `/home/swarm/`: `instances/<id>.env`, `workspaces/<id>`, `.pi/agent/sessions`. Anything that must be reproducible from source goes in the Containerfile.

## What `bootc upgrade` does to running workers

Per arch.md:401-408: `bootc upgrade` stages the new image, the operator (or auto-update timer) reboots, systemd stops worker containers, the host pivots to the new deployment, Quadlets regenerate from the new `/etc/containers/systemd/`, and workers start fresh. **In-flight `pi` conversations are not preserved across the swap** unless the manager forks sessions first. v1 does no graceful drain — this is a known limitation, not a bug to fix in the bootc layer.

## Gotchas to watch for

- **`/var` is a volume, not image content.** Anything `COPY`d into `/var` is unpacked once on initial install and then frozen. `bootc upgrade` does not refresh `/var`. For runtime-needed directories, use `tmpfiles.d` (already done for `/run/pi-swarm/` per arch.md:377-378). The `pi-worker.tar` import in arch.md:369-370 lands content under `/var/lib/containers/` — confirm during testing that it is present after a real install, not just after a `podman build`.
- **`/etc` uses 3-way merge.** Image changes to `/etc` files are merged against local edits across upgrades. Prefer drop-ins (e.g., `/etc/sudoers.d/`) over editing distro defaults.
- **No `RUN podman pull` in the Containerfile.** Nesting OCI containers during build causes whiteout conflicts. The `podman load` of the prebuilt `pi-worker.tar` tarball is the supported pattern; do not switch it to a `podman pull`.
- **`useradd swarm` runs at build time.** The user exists in the image's `/etc/passwd`. Local edits on the running host risk drift across upgrades; treat `swarm`'s shell, home, groups as image-defined.
- **Linger must be enabled in the image.** `loginctl enable-linger swarm` (arch.md:381) is what lets user-mode systemd start at boot, before any login. Without it the manager Quadlet never fires on cold boot.
- **Read-only root.** Any first-boot script that wants to write outside `/etc`, `/var`, `/home`, `/run`, `/tmp` will fail. Move it into the image build, or write under the swarm home.
- **Run `bootc container lint` as the final Containerfile step.** It catches missing tmpfiles.d entries, bad `/var` content, and other build-time mistakes before they become boot-time mistakes.
- **`bootc switch` vs `bootc upgrade`.** `switch` changes the *image reference being tracked* (e.g., from `:latest` to a pinned tag). `upgrade` re-pulls the currently tracked ref. Both stage; neither reboots without `--apply`.

## When to reach for the references

- Writing or auditing the Containerfile (which paths, which RUN steps, where things land): see `references/containerfile-authoring.md`.
- Working out what command to run on the host to inspect, stage, apply, or roll back a deployment: see `references/cli.md`.
- Reasoning about what happens during a `bootc upgrade` (especially around running workers, `/var`, `/etc` merges, anaconda-based first install): see `references/update-model.md`.

## Authoritative URLs

- bootc project: https://github.com/bootc-dev/bootc
- bootc docs: https://bootc.dev/bootc/
- Fedora bootc docs: https://docs.fedoraproject.org/en-US/bootc/
- Fedora base images: https://gitlab.com/fedora/bootc/base-images
- Red Hat best-practices: https://developers.redhat.com/articles/2025/02/26/best-practices-building-bootable-containers
