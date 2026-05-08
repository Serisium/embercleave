# @serisium/embercleave-manager

Manager-side pi extension for the [embercleave](https://github.com/seri/embercleave)
swarm. **Manager pi only.** Workers must not load this package.

Binds the JSONL bus on `session_start`, maintains the worker registry,
routes topic publish/subscribe, surfaces `handoff_request`s as synthetic
user messages, renders a status widget above the editor, and exposes the
manager LLM tools `swarm_list`, `swarm_steer`, `swarm_send_snippet`,
`swarm_logs`, `swarm_inspect`.

On startup, reconciles the registry against
`systemctl --user list-units 'embercleave-worker@*.service'` so workers
that survived a manager restart are discoverable as "running but
unreachable" until they reconnect.

## Install

```bash
npm install -g @serisium/embercleave-manager @serisium/embercleave-protocol @mariozechner/pi-coding-agent
```

`@mariozechner/pi-coding-agent` is a peer dependency.

## Configuration

| Var                  | Default                      | Purpose          |
| -------------------- | ---------------------------- | ---------------- |
| `EMBERCLEAVE_SOCKET` | `/run/embercleave/bus.sock`  | Bus UDS path.    |

## Tools registered

- **`swarm_list()`** — JSON list of every worker (connected + unreachable).
- **`swarm_steer(agentId, message)`** — inject a synthetic user message
  into a worker's session.
- **`swarm_send_snippet(agentId, snippetId, content)`** — push a
  `<context-snippet>` block for the worker to inject on its next turn.
- **`swarm_logs(agentId, lines?)`** — tail journald for the worker's
  systemd unit.
- **`swarm_inspect(agentId)`** — `podman inspect` the worker's container.

See the project [`arch.md`](https://github.com/seri/embercleave/blob/main/arch.md)
§4.3 for the manager contract and §8 for the authority model.

## License

MIT
