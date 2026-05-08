import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/**
 * Worker lifecycle status as observed on the bus. The wire-level value is
 * either `"thinking"`, `"idle"`, or a `tool:<toolName>` template string.
 * arch.md:158-162 specifies the mapping from pi events; this schema is
 * the protocol surface only.
 */
export const WorkerStatusSchema = Type.Union([
  Type.Literal("thinking"),
  Type.Literal("idle"),
  Type.TemplateLiteral([Type.Literal("tool:"), Type.String()]),
]);

export type WorkerStatus = Static<typeof WorkerStatusSchema>;

/** worker → manager. State change for the worker's pi session. */
export const AgentStatusSchema = Type.Object({
  kind: Type.Literal("agent_status"),
  agentId: AgentIdSchema,
  status: WorkerStatusSchema,
});

export type AgentStatus = Static<typeof AgentStatusSchema>;
