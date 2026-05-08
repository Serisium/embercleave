import { type Static, Type } from "typebox";
import { AgentIdSchema } from "../agent-id.js";

/**
 * worker → manager. First message on every bus connection. Carries the
 * worker's agentId, working directory, and protocol version. The manager
 * closes the connection on protocol-version major mismatch (arch.md:144-146).
 */
export const WorkerHelloSchema = Type.Object({
  kind: Type.Literal("worker_hello"),
  agentId: AgentIdSchema,
  cwd: Type.String(),
  protocolVersion: Type.String(),
});

export type WorkerHello = Static<typeof WorkerHelloSchema>;
