# image — Layer 1 bootc OS image

The hardened fedora-bootc image that boots an embercleave host. Packages
the four `@serisium/embercleave-*` npm modules + pi-coding-agent globally,
embeds the runtime container that worker and manager Quadlets start, and
ships the systemd target + tmpfiles.d that wire it all together.

See [`arch.md`](../arch.md) §7 for the full lifecycle and `skills/bootc/`
for the rules every Containerfile change must follow.

## Layout

```
Containerfile                           # bootc OS image
worker/Containerfile                    # worker runtime container, embedded via podman load
quadlets/embercleave-worker@.container  # template, started by @serisium/embercleave-quadlet
systemd/embercleave-mgr.service         # manager pi — runs on the host, not in a container
systemd/embercleave.target              # user-level group + ordered shutdown
tmpfiles.d/embercleave.conf             # /run/embercleave/ ownership at boot
scripts/                                # build, lint, test wrappers
test/unit/                              # vitest — unit/quadlet content assertions
test/structure/                         # container-structure-test specs
test/plans/, test/tests/                # tmt plan + boot-test (real VM)
```

## Build & test

```bash
# Unit tests (no podman required)
pnpm -r run test

# Build images (needs Linux + podman)
pnpm run build:image

# Lint Containerfiles
pnpm run lint:image

# Container-structure-test against built images
pnpm run test:image:structure

# Boot the bootc image in a VM, run smoke checks (slow; main-only in CI)
pnpm run test:image:boot
```

## Notes

- **Manager runs on the host, workers run in containers.** This is a
  deliberate deviation from `arch.md` §7's `embercleave-mgr.container`
  sketch: the manager is the trusted control plane that owns the swarm,
  so containerizing it adds an indirection without a real isolation
  benefit. The bootc image installs all four `@serisium/embercleave-*`
  packages globally; the manager runs from `/usr/bin/pi` under swarm's
  user-mode systemd. Workers stay containerized via
  `embercleave-worker@.container` because they are the untrusted blast
  radius — one runaway pi shouldn't be able to touch the host.
- The `fedora-bootc` base is digest-pinned via the `FEDORA_BOOTC_DIGEST`
  build arg; `scripts/build-bootc.sh` resolves the current `:latest` digest
  if not provided.
- The Quadlet template here is **image-managed** and read-only at runtime.
  The TS package [`@serisium/embercleave-quadlet`](../packages/quadlet)
  generates the **per-instance** files (`%h/.config/embercleave/instances/<id>.env`)
  consumed by the template, at runtime.
