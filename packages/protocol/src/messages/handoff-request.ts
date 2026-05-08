import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/**
 * worker → manager. Worker asks the manager to take over. The manager
 * surfaces this through `pi.sendUserMessage` so its own LLM sees it as if
 * a human had typed it (arch.md:188-194).
 */
export const HandoffRequestSchema = Type.Object({
  kind: Type.Literal("handoff_request"),
  agentId: AgentIdSchema,
  reason: Type.String(),
  context: Type.String(),
});

export type HandoffRequest = Static<typeof HandoffRequestSchema>;
