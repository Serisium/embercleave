import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/** worker → manager. Subscribe to a topic; subsequent `topic_message`s on it land in the worker. */
export const SubscribeSchema = Type.Object({
  kind: Type.Literal("subscribe"),
  agentId: AgentIdSchema,
  topic: Type.String(),
});

export type Subscribe = Static<typeof SubscribeSchema>;
