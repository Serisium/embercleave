import type { Publish, TopicMessage } from "@serisium/embercleave-protocol";
import type { BusServerPort } from "../adapters/bus-server.port.js";
import type { TopicRouter } from "../domain/topic-router.js";

export interface RouteTopicMessageDeps {
  readonly router: TopicRouter;
  readonly busServer: BusServerPort;
}

export interface RouteTopicMessageInput {
  readonly publish: Publish;
}

/**
 * Fan a `publish` out to all current subscribers of its topic as
 * `topic_message`s. Per-subscriber send failures are tolerated; one slow
 * worker should not block the others.
 */
export async function routeTopicMessage(
  deps: RouteTopicMessageDeps,
  input: RouteTopicMessageInput,
): Promise<void> {
  const subscribers = deps.router.subscribers(input.publish.topic);
  if (subscribers.length === 0) return;
  const message: TopicMessage = {
    kind: "topic_message",
    topic: input.publish.topic,
    payload: input.publish.payload,
    fromAgentId: input.publish.agentId,
  };
  const line = JSON.stringify(message);
  await Promise.allSettled(subscribers.map((cid) => deps.busServer.send(cid, line)));
}
