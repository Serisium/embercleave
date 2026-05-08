import type { Subscribe } from "@serisium/embercleave-protocol";
import type { BusClientPort } from "../adapters/bus-client.port.js";

export interface SubscribeToTopicDeps {
  readonly busClient: BusClientPort;
}

export interface SubscribeToTopicInput {
  readonly agentId: string;
  readonly topic: string;
}

/** Send a `subscribe` over the bus. arch.md §4.2 `swarm_subscribe`. */
export async function subscribeToTopic(
  deps: SubscribeToTopicDeps,
  input: SubscribeToTopicInput,
): Promise<void> {
  const message: Subscribe = {
    kind: "subscribe",
    agentId: input.agentId,
    topic: input.topic,
  };
  await deps.busClient.send(JSON.stringify(message));
}
