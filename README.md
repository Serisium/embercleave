# embercleave

A custom OS image for the Podman Desktop virtual machine, derived from
`quay.io/podman/machine-os` (the bootc image the machine already boots).
The eventual goal is a swarm of [`pi`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)
coding agents running as containers inside that VM, visible in Podman
Desktop. Right now it is a hello-world image proving the
build → switch → verify loop.

The architecture — all of it, no futures — is in [`arch.md`](./arch.md).

## Use

```bash
podman build -t localhost/embercleave-os:dev .
podman machine os apply containers-storage:localhost/embercleave-os:dev --restart
podman machine ssh "cat /usr/lib/embercleave-release"
```

Roll back with `podman machine ssh sudo bootc rollback` and restart the
machine.

## License

MIT
