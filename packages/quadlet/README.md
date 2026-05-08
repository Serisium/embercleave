# @serisium/embercleave-quadlet

Manager-side pi extension that spawns and stops [embercleave](https://github.com/seri/embercleave)
worker pis via Quadlet-managed systemd user units. **Manager pi only.**

Owns `swarm_spawn` and `swarm_stop`. The actual unit definition lives at
`/etc/containers/systemd/embercleave-worker@.container` (image-managed
by the bootc layer). This package only manipulates instances of that
template plus the per-instance env file and workspace directory.

## Install

```bash
npm install -g @serisium/embercleave-quadlet @serisium/embercleave-protocol @mariozechner/pi-coding-agent
```

`@mariozechner/pi-coding-agent` is a peer dependency.

## Tools registered

- **`swarm_spawn(agentId, model?, initialPrompt?)`** — write
  `~/.config/embercleave/instances/<agentId>.env`, ensure
  `~/embercleave/workspaces/<agentId>/` exists, and
  `systemctl --user start embercleave-worker@<agentId>.service`.
- **`swarm_stop(agentId, removeWorkspace?)`** —
  `systemctl --user stop` the worker, remove the env file, and
  optionally remove the workspace directory.

`agentId` must match `^[a-z0-9-]+$` — it flows into systemd unit names,
container names, and filesystem paths (`arch.md` §4.4).

This package does NOT read container state. That belongs to
`@serisium/embercleave-manager` (which talks to the Podman REST socket for
`swarm_inspect`).

See the project [`arch.md`](https://github.com/seri/embercleave/blob/main/arch.md)
§4.4 and §6 for the full contract.

## License

MIT
