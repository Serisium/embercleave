# Embercleave — Architecture

**Status:** v2, rewritten 2026-06-10 after discarding the first iteration.

This document describes only what is decided and being built right now.
If something isn't here, it isn't decided. Do not add speculative or
deferred material to this file.

---

## 1. What this is

Embercleave is a custom operating system image for the Podman Desktop
virtual machine. The VM that Podman Desktop runs (`podman machine`) is
itself a bootc system booted from `quay.io/podman/machine-os`. We derive
our own image from that base and tell the machine to switch into it.

The end goal is a swarm of `pi` coding agents running as containers
inside that VM, visible and manageable through Podman Desktop. The
current iteration is deliberately smaller: a hello-world derived image
that boots, proves the build→switch→verify loop works, and gives us a
foundation to grow one auditable file at a time.

## 2. Decisions

### D1 — Base image: `quay.io/podman/machine-os:<podman-major.minor>`

The machine's OS, not generic `fedora-bootc`, is the base. This is what
`podman machine` already boots (verified on this workstation: the VM is
booted from `quay.io/podman/machine-os:5.7` via bootc, registry
transport), so a derived image keeps every machine-specific bit —
virtiofs mounts, the API socket forwarding, the `core` user, rootless
podman defaults — without us re-creating any of it.

The tag must match the podman version inside the VM
(<https://docs.podman.io/en/latest/markdown/podman-machine-os-apply.1.html>).
We build from `:5.8` to match the workstation's podman 5.8.2 client.

### D2 — Deployment: `podman machine os apply`

The image reaches the VM with `podman machine os apply <image>`, which
runs `bootc switch` inside the machine. No qcow2 builds, no
bootc-image-builder, no cloud-init, no Proxmox. Rollback is
`podman machine ssh sudo bootc rollback` or re-applying the stock
`quay.io/podman/machine-os` tag.

### D3 — Host architecture only

Images are built for the architecture of the machine doing the building
(Apple Silicon → arm64). No multi-arch manifests, no cross-builds, no
remote machine support.

### D4 — Everything runs as containers; the OS image stays minimal

This reverses the v1 decision to run the manager `pi` as a bare host
process. Red Hat's documented approach for bootc / image-mode hosts is
that the host image stays minimal and applications run as containers
managed by quadlets shipped in the image
(<https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/managing-users-groups-ssh-key-and-secrets-in-image-mode-for-rhel_using-image-mode-for-rhel-to-build-deploy-and-manage-operating-systems>,
and the quadlet docs at
<https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>).

Concretely:

- Long-running services (eventually the manager `pi`) are quadlet
  `.container` files installed at `/etc/containers/systemd/users/`,
  which instantiates them for the `core` user's rootless podman.
- Short-lived workers (eventually worker `pi`s) are plain containers the
  manager creates through the podman API. No systemd template units, no
  `systemctl --user` from inside a container.
- Nothing is installed on the host OS beyond quadlet files and static
  configuration. No Node.js on the host.

Why this beats v1's manager-on-host: it follows the documented Red Hat
pattern instead of fighting it; every running piece shows up in Podman
Desktop's container list; and the v1 rationale (the manager needed
`systemctl --user` to start quadlet template instances) dissolves once
workers are API-created containers instead of systemd units.

### D5 — Rootless under `core`, control via the podman socket

All containers run under the existing `core` user's rootless podman —
the same storage and socket Podman Desktop already points at. The VM
already has linger enabled for `core`, so quadlet user units start at
boot.

A container that needs to manage sibling containers (the manager) gets
the rootless podman socket bind-mounted and talks to the REST API. This
is the documented "podman remote inside a container" pattern
(<https://www.redhat.com/en/blog/podman-inside-container>). No rootful
podman; nothing runs as root beyond what the stock machine-os already
does.

### D6 — Human interface: SSH + tmux

`podman machine ssh` is the way in. Interactive sessions live in tmux
inside the VM. No UI service of any kind is part of this architecture.

## 3. Repository layout

The repo is intentionally small enough to audit in one sitting:

```
Containerfile      The derived machine-os image. The whole OS build.
os/                Files COPY'd into the image (quadlets, config).
arch.md            This document.
AGENTS.md          Agent operating instructions; points here.
skills/            Reference documentation for the tools in play.
```

Every new file must earn its place. Prefer extending the Containerfile
and `os/` over adding scripts, generators, or build layers.

## 4. The build → switch → verify loop

```bash
# Build (image lands in the machine's containers-storage for user core)
podman build -t localhost/embercleave-os:dev .

# Switch the machine into it (bootc switch + reboot)
podman machine os apply containers-storage:localhost/embercleave-os:dev --restart

# Verify
podman machine ssh "cat /usr/lib/embercleave-release && sudo bootc status"

# Roll back if unhappy
podman machine ssh sudo bootc rollback && podman machine stop && podman machine start
```

## 5. Scope of this iteration

The image contains exactly:

1. A release marker at `/usr/lib/embercleave-release` proving the
   derived image is the one booted.
2. One quadlet, `embercleave-hello.container`, that starts a
   long-running `embercleave-hello` container under `core` at boot —
   proof of life visible in Podman Desktop's container list. (It must
   be long-running: quadlet containers always get `--rm`, so a
   run-once container would exit and vanish from the list.)

That's the whole system until it boots and both proofs check out.
