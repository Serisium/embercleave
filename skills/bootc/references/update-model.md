# bootc transactional update model

This is what *actually happens* when an embercleave host upgrades, and how to reason about state preservation.

## The A/B deployment model

bootc keeps multiple deployments on disk, each rooted under `/ostree/deploy/<stateroot>/deploy/<checksum>/`. At any moment there are up to three relevant ones:

- **booted** — what is currently running.
- **staged** — what `bootc upgrade` or `bootc switch` queued. Becomes the booted deployment on next reboot.
- **rollback** — the previously-booted deployment, kept for `bootc rollback`.

`bootc status` lists all three. The bootloader (managed by `bootupd`) decides which one boots.

## What `bootc upgrade` actually does

1. Resolves the tracked image reference.
2. Pulls the image into ostree's container store (only changed layers are fetched — content addressing means unchanged layers are deduplicated against the booted deployment).
3. Materializes a new deployment under `/ostree/deploy/...`.
4. Computes a 3-way merge for `/etc` between (image's old `/etc`) → (image's new `/etc`) ↔ (running system's `/etc`). Local edits survive unless they conflict.
5. Updates the bootloader to point next-boot at the new deployment.
6. **Does not reboot.** The running system is untouched until you reboot (or pass `--apply`).

The running root filesystem is not modified. This is the "transactional, in-place" guarantee — there is no partial-update window. Either you boot the new deployment cleanly, or you boot the old one.

## What survives an upgrade

| Path | Survives? | Why |
|---|---|---|
| `/usr` content | replaced | image-managed |
| `/etc` (changes) | merged | 3-way merge against image baseline |
| `/var` | preserved as-is | VOLUME semantics; image `/var` only seeds initial install |
| `/home` | preserved | not touched by bootc |
| `/root` | preserved | not touched by bootc |
| `/run`, `/tmp` | n/a | tmpfs, gone on reboot regardless |

For embercleave (arch.md:384-399, 401-408): everything under `/home/swarm/` survives. Quadlet definitions in `/etc/containers/systemd/` are replaced with whatever the new image ships. `/run/pi-swarm/` is recreated by `tmpfiles.d` on boot.

## What happens to running workers

Per arch.md:401-408:

1. Operator runs `bootc upgrade` (or `bootc upgrade --apply`).
2. Operator reboots.
3. systemd stops all units in shutdown order. Worker Quadlets stop their containers; SIGTERM → grace → SIGKILL.
4. The host pivots to the new deployment.
5. On next boot, the Podman Quadlet generator re-reads `/etc/containers/systemd/` from the new image and emits transient `*.service` units.
6. Worker containers start fresh. Any in-flight `pi` conversation state inside the worker process is lost. State persisted under `/home/swarm/.pi/agent/sessions` is preserved, but resumption is the manager's responsibility (v1 does not auto-resume).

There is no graceful drain in v1. The manager has no hook that says "don't reboot until workers are quiescent."

## When to drain manually

Before `bootc upgrade --apply` on a busy host, the operator should:

1. Tell the manager `pi` instance to stop accepting new work.
2. Wait for active workers to finish or `/handoff` their sessions.
3. Confirm via `bootc status` that the right image is staged.
4. Reboot.

This is documented as v1 limitation, not a bug. A future graceful-drain hook is on the roadmap.

## Anaconda integration (first install)

For initial provisioning of a fresh host (not an upgrade), the path is one of:

- **bootc-image-builder** — converts the OCI image into a disk image (qcow2, raw, ISO, AMI). Best for cloud images and VM templates.
- **Anaconda + bootc install to-filesystem** — Anaconda is the standard Fedora installer. It runs interactively or via kickstart, sets up partitioning/LUKS/LVM, mounts the target, then invokes `bootc install to-filesystem /mnt/sysroot` to lay down the deployment.
- **`bootc install to-disk`** — simple direct-to-block-device flow, mostly for demos and quick VM testing.

For embercleave the deployment story is "build the image, ship it as a disk image via bootc-image-builder, boot the host on it." Day-2 updates are then `bootc upgrade`.

## Auto-apply timer

bootc ships `bootc-fetch-apply-updates.timer`, which would run `bootc upgrade --apply` automatically. **Do not enable it on embercleave hosts in v1** — automated reboots interrupt worker conversations without warning. Updates should be operator-driven until graceful drain exists.

## Failure modes and rollback

If a new deployment boots but fails (a critical service crash-loops, network is broken, etc.):

```sh
bootc rollback
systemctl reboot
```

This swaps the bootloader to the previous deployment. The failed deployment stays on disk; you can investigate with `bootc status` and `journalctl --boot=-1`.

If a new deployment fails to even reach a usable shell, GRUB's "previous deployment" entry is the manual fallback. bootc/ostree keeps the previous deployment bootable specifically for this case.

## URLs

- Upgrade and rollback: https://bootc.dev/bootc/upgrades.html
- Filesystem and what survives: https://bootc.dev/bootc/filesystem.html
- Install paths: https://bootc.dev/bootc/bootc-install.html
- bootc-image-builder: https://osbuild.org/docs/bootc/
- Anaconda + bootc: https://docs.fedoraproject.org/en-US/bootc/
- ostree /var handling: https://ostreedev.github.io/ostree/var/
