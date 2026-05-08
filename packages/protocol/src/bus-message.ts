import { type Static, Type } from "typebox";
import { AgentStatusSchema } from "./messages/agent-status.js";
import { HandoffRequestSchema } from "./messages/handoff-request.js";
import { PublishSchema } from "./messages/publish.js";
import { SnippetPushSchema } from "./messages/snippet-push.js";
import { SteerSchema } from "./messages/steer.js";
import { SubscribeSchema } from "./messages/subscribe.js";
import { TopicMessageSchema } from "./messages/topic-message.js";
import { WorkerHelloSchema } from "./messages/worker-hello.js";

/**
 * Discriminated union of every wire message on the bus. The discriminator
 * is `kind`. See arch.md §5 for the full message-kinds table.
 */
export const BusMessageSchema = Type.Union([
  WorkerHelloSchema,
  AgentStatusSchema,
  SubscribeSchema,
  PublishSchema,
  TopicMessageSchema,
  SnippetPushSchema,
  SteerSchema,
  HandoffRequestSchema,
]);

export type BusMessage = Static<typeof BusMessageSchema>;
