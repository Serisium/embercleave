import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/** worker → manager. Publish payload to all current subscribers of `topic`. */
export const PublishSchema = Type.Object({
  kind: Type.Literal("publish"),
  agentId: AgentIdSchema,
  topic: Type.String(),
  payload: Type.Unknown(),
});

export type Publish = Static<typeof PublishSchema>;
