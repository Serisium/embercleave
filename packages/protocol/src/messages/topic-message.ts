import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/**
 * manager → worker. Fan-out delivery of a `publish` to a subscriber.
 * Carries the originating agentId so the receiver can attribute the message.
 */
export const TopicMessageSchema = Type.Object({
  kind: Type.Literal("topic_message"),
  topic: Type.String(),
  payload: Type.Unknown(),
  fromAgentId: AgentIdSchema,
});

export type TopicMessage = Static<typeof TopicMessageSchema>;
