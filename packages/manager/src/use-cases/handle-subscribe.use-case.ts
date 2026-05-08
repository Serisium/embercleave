import type { Subscribe } from "@serisium/embercleave-protocol";
import type { TopicRouter } from "../domain/topic-router.js";

export interface HandleSubscribeDeps {
  readonly router: TopicRouter;
}

export interface HandleSubscribeInput {
  readonly clientId: string;
  readonly subscribe: Subscribe;
}

/** Add a subscription to the topic router. */
export function handleSubscribe(deps: HandleSubscribeDeps, input: HandleSubscribeInput): void {
  deps.router.subscribe(input.clientId, input.subscribe.topic);
}
