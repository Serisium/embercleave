# Project: embercleave

A custom bootc OS image for the Podman Desktop VM, derived from
`quay.io/podman/machine-os`, that will eventually host a swarm of `pi`
coding agents as rootless containers under the `core` user.

The architecture spec is **`arch.md`**. It contains only settled
decisions — read it before any non-trivial change, and never add
speculative/deferred material to it.

## Working rules

- **Small and auditable beats fast.** The human is following every
  file. Prefer one well-explained file over three generated ones. Do
  not scaffold ahead of the current iteration's scope (`arch.md` §5).
- The whole OS build is the root `Containerfile` plus `os/`. No build
  scripts, no CI, no TS workspace — don't reintroduce them without
  being asked.
- Everything deploys as a container (arch.md D4). Nothing is installed
  on the host OS; the manager-on-host design from v1 is dead.
- Build/test loop: `podman build -t localhost/embercleave-os:dev .`,
  then `podman machine os apply containers-storage:localhost/embercleave-os:dev --restart`,
  then verify over `podman machine ssh`.

## Skills

`skills/` holds reference docs (progressive disclosure: read a
`SKILL.md` only when its trigger hits, follow its `references/` links
only as routed).

Active for this iteration:

- [`bootc`](skills/bootc/SKILL.md) — editing the Containerfile; `bootc
  status`/`switch`/`rollback`; what survives an image swap.
- [`podman`](skills/podman/SKILL.md) — rootless podman, the REST
  socket, image storage.
- [`quadlet`](skills/quadlet/SKILL.md) — `.container` files under
  `/etc/containers/systemd/users/`, key mapping, daemon-reload rules.
- [`systemd-units`](skills/systemd-units/SKILL.md) — user units,
  linger, journald debugging.
- [`skill-maintenance`](skills/skill-maintenance/SKILL.md) — authoring
  or updating any skill; fetching upstream docs.

Dormant (kept for when the `pi` workload returns; don't load
otherwise): [`pi-coding-agent`](skills/pi-coding-agent/SKILL.md),
[`typebox`](skills/typebox/SKILL.md), [`vitest`](skills/vitest/SKILL.md),
[`biome`](skills/biome/SKILL.md),
[`tsc-project-refs`](skills/tsc-project-refs/SKILL.md). Note their
bodies may still cite the swept v1 layout (`packages/`, the bus
protocol); trust `arch.md` over them on any conflict.
