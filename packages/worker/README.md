# @serisium/embercleave-worker

Worker-side pi extension for the [embercleave](https://github.com/seri/embercleave)
swarm. Installed in **every** pi instance (including the manager pi).

Connects to the manager's UDS bus, identifies via `worker_hello`,
forwards `agent_status`, buffers and injects context snippets, and
exposes the worker LLM tools `swarm_publish`, `swarm_subscribe`, and
`swarm_request_handoff`.

## Install

```bash
npm install -g @serisium/embercleave-worker @serisium/embercleave-protocol @mariozechner/pi-coding-agent
```

`@mariozechner/pi-coding-agent` is a peer dependency.

## Configuration

Environment variables (read at extension load time):

| Var                       | Default                        | Purpose                                   |
| ------------------------- | ------------------------------ | ----------------------------------------- |
| `EMBERCLEAVE_AGENT_ID`    | `embercleave-${pid}`           | Worker's agentId (must match `^[a-z0-9-]+$`). |
| `EMBERCLEAVE_SOCKET`      | `/run/embercleave/bus.sock`    | Bus UDS path.                             |

The Quadlet template at `arch.md` §6 sets both vars per-instance.

## Tools registered

- **`swarm_publish(topic, payload)`** — publish JSON to a topic.
- **`swarm_subscribe(topic)`** — receive `topic_message`s for a topic.
- **`swarm_request_handoff(reason, context)`** — escalate to the
  manager (surfaced as a synthetic user message in the manager pi).

See the project [`arch.md`](https://github.com/seri/embercleave/blob/main/arch.md)
§4.2 for the worker contract.

## License

MIT
