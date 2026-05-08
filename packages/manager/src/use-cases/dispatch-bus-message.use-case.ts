import { type BusMessage, BusMessageSchema } from "@serisium/embercleave-protocol";
import { Value } from "typebox/value";
import type { BusServerPort } from "../adapters/bus-server.port.js";
import type { TopicRouter } from "../domain/topic-router.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";
import { acceptWorker } from "./accept-worker.use-case.js";
import { handleSubscribe } from "./handle-subscribe.use-case.js";
import { routeTopicMessage } from "./route-topic-message.use-case.js";
import { surfaceHandoff } from "./surface-handoff.use-case.js";

export interface DispatchBusMessageDeps {
  readonly registry: WorkerRegistry;
  readonly router: TopicRouter;
  readonly busServer: BusServerPort;
  readonly log: (message: string) => void;
  readonly now: () => number;
  readonly sendUserMessage: (text: string) => void;
  readonly onStateChange: () => void;
}

export interface DispatchBusMessageInput {
  readonly clientId: string;
  readonly line: string;
}

/**
 * Parse a JSONL line, validate against {@link BusMessageSchema}, and
 * route by `kind` to the matching use-case. Invalid input is logged and
 * dropped. arch.md §5 (wire format), arch.md §4.3 (manager
 * responsibilities).
 */
export async function dispatchBusMessage(
  deps: DispatchBusMessageDeps,
  input: DispatchBusMessageInput,
): Promise<void> {
  const message = parseBusMessage(input.line);
  if (message === undefined) {
    deps.log(`bus rx ${input.clientId}: invalid bus message; dropped`);
    return;
  }
  switch (message.kind) {
    case "worker_hello": {
      const result = await acceptWorker(
        { registry: deps.registry, busServer: deps.busServer, now: deps.now },
        { clientId: input.clientId, hello: message },
      );
      if (result.accepted) {
        deps.log(`hello: ${input.clientId} → ${message.agentId}`);
      } else {
        deps.log(
          `hello rejected: ${input.clientId} (${message.agentId}, v${message.protocolVersion})`,
        );
      }
      deps.onStateChange();
      return;
    }
    case "subscribe":
      handleSubscribe({ router: deps.router }, { clientId: input.clientId, subscribe: message });
      deps.onStateChange();
      return;
    case "publish":
      await routeTopicMessage(
        { router: deps.router, busServer: deps.busServer },
        { publish: message },
      );
      return;
    case "agent_status":
      deps.registry.setStatus(input.clientId, message.status, deps.now());
      deps.onStateChange();
      return;
    case "handoff_request":
      surfaceHandoff({ sendUserMessage: deps.sendUserMessage }, message);
      deps.log(`handoff request from ${message.agentId}: ${message.reason}`);
      return;
    case "topic_message":
    case "snippet_push":
    case "steer":
      // Manager → worker kinds; receiving them from a worker is a protocol
      // violation. Drop and log.
      deps.log(`bus rx ${input.clientId}: unexpected kind ${message.kind}`);
      return;
  }
}

function parseBusMessage(line: string): BusMessage | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!Value.Check(BusMessageSchema, value)) return undefined;
  return value as BusMessage;
}
