# @serisium/embercleave-protocol

Wire protocol types and Typebox schemas for the [embercleave](https://github.com/seri/embercleave)
swarm bus. Types only — no runtime behaviour beyond pure validators.

## What's in here

- `PROTOCOL_VERSION`, `isMajorMatch(local, remote)` — major-version
  compatibility check used on `worker_hello`.
- `AGENT_ID_PATTERN`, `AgentIdSchema`, `isValidAgentId(value)` — the
  `^[a-z0-9-]+$` agentId validator.
- `BusMessageSchema`, `BusMessage` — discriminated union of every wire
  message (`worker_hello`, `agent_status`, `subscribe`, `publish`,
  `topic_message`, `snippet_push`, `steer`, `handoff_request`).
- Per-kind schema and inferred type, e.g. `WorkerHelloSchema` /
  `WorkerHello`.

## Install

```bash
npm install @serisium/embercleave-protocol
```

## Usage

```ts
import {
  BusMessageSchema,
  PROTOCOL_VERSION,
  type WorkerHello,
} from "@serisium/embercleave-protocol";
import { Value } from "typebox/value";

const hello: WorkerHello = {
  kind: "worker_hello",
  agentId: "alice",
  cwd: "/workspace",
  protocolVersion: PROTOCOL_VERSION,
};
JSON.stringify(hello); // safe to send on the bus

const incoming: unknown = JSON.parse(line);
if (Value.Check(BusMessageSchema, incoming)) {
  // incoming is now typed as BusMessage
}
```

See the project [`arch.md`](https://github.com/seri/embercleave/blob/main/arch.md)
§4.1 and §5 for the full wire-format contract.

## License

MIT
