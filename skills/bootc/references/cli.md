# bootc CLI reference

Run on the bootc host (not in the container build). All commands need root.

## `bootc status`

Shows current booted deployment, staged (next-boot) deployment, and rollback (previous) deployment. Each entry includes the image reference, digest, version label, and timestamp.

```sh
bootc status              # human-readable
bootc status --json       # machine-readable
bootc status --verbose    # include deployment details, including download-only flag
```

Use this first when debugging "did my upgrade actually stage?" or "what image is actually running?".

## `bootc upgrade`

Pulls the currently tracked image reference and stages it as the next-boot deployment. **Does not reboot by default** — the running system is unchanged until reboot.

```sh
bootc upgrade                       # pull latest, stage for next boot
bootc upgrade --apply               # pull, stage, then reboot if there's an update
bootc upgrade --check               # check only; do not download or stage
bootc upgrade --download-only       # pull + stage, but mark not-yet-applicable
bootc upgrade --from-downloaded     # apply a previously download-only stage
```

If you reboot before applying a `--download-only` stage, the staged deployment is discarded; the cached image data is kept.

## `bootc switch <image-ref>`

Changes the image reference the host tracks, then stages it. Same as `upgrade` mechanically, but updates the tracked ref.

```sh
bootc switch quay.io/embercleave/host:latest
bootc switch --transport containers-storage embercleave-host:dev
```

Use this when moving between channels (e.g., `:latest` to `:stable`) or pinning to a digest. embercleave's update path is normally `bootc upgrade` once the tracked ref is set.

## `bootc rollback`

Swaps the bootloader ordering so the *previous* deployment becomes the next boot. Requires reboot to take effect. Use this when an upgrade boots but misbehaves.

```sh
bootc rollback
systemctl reboot
```

## `bootc install`

Used during initial provisioning, **not** during normal upgrades. Two main forms:

### `bootc install to-disk <device>`

Wipes the device and writes a complete bootable system. Container must be run `--privileged` with the host kernel. Demo/simple-case form.

```sh
podman run --privileged --pid=host -v /dev:/dev -v /var/lib/containers:/var/lib/containers \
  --rm <image> bootc install to-disk /dev/vda
```

### `bootc install to-filesystem <mountpoint>`

Installs into a filesystem prepared by an external installer (Anaconda, bootc-image-builder, custom script). This is what production-grade installs use because it lets the installer set up LUKS, LVM, custom partitioning, etc. before bootc lays down the deployment.

```sh
bootc install to-filesystem /mnt/target
```

For embercleave the expected first-install path is bootc-image-builder producing a disk image (qcow2/ISO/raw) from the Containerfile, then booting that on the target host.

## Other useful subcommands

- `bootc container lint` — run inside the container during build (final `RUN` step). Validates Containerfile output.
- `bootc edit` — edit the deployment spec (rarely needed; for advanced cases like changing signature policy).
- `bootc usroverlay` — make `/usr` writable for the current boot for emergency debugging. Wiped on next deployment swap. Do not use as a workflow.

## Auto-update

bootc ships a `bootc-fetch-apply-updates.timer` that runs `bootc upgrade --apply` on a schedule. embercleave does *not* enable this by default — image swaps interrupt worker sessions (arch.md:401-408), so updates are operator-driven.

To check or enable:

```sh
systemctl status bootc-fetch-apply-updates.timer
systemctl enable --now bootc-fetch-apply-updates.timer
```

## URLs

- CLI overview: https://bootc.dev/bootc/man/bootc.html
- Upgrade and rollback: https://bootc.dev/bootc/upgrades.html
- Install: https://bootc.dev/bootc/bootc-install.html
- RHEL image-mode CLI chapter: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/managing-rhel-bootc-images
