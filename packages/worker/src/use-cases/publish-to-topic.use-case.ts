import type { Publish } from "@serisium/embercleave-protocol";
import type { BusClientPort } from "../adapters/bus-client.port.js";

export interface PublishToTopicDeps {
  readonly busClient: BusClientPort;
}

export interface PublishToTopicInput {
  readonly agentId: string;
  readonly topic: string;
  readonly payload: unknown;
}

/** Send a `publish` over the bus. arch.md §4.2 `swarm_publish`. */
export async function publishToTopic(
  deps: PublishToTopicDeps,
  input: PublishToTopicInput,
): Promise<void> {
  const message: Publish = {
    kind: "publish",
    agentId: input.agentId,
    topic: input.topic,
    payload: input.payload,
  };
  await deps.busClient.send(JSON.stringify(message));
}
