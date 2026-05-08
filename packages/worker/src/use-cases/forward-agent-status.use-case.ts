import type { AgentStatus, WorkerStatus } from "@serisium/embercleave-protocol";
import type { BusClientPort } from "../adapters/bus-client.port.js";
import type { WorkerPiEvent } from "../adapters/pi-host.port.js";

export interface ForwardAgentStatusDeps {
  readonly busClient: BusClientPort;
}

export interface ForwardAgentStatusInput {
  readonly agentId: string;
  readonly event: WorkerPiEvent;
}

/**
 * Translate a pi lifecycle event into a wire-level `agent_status` and
 * publish it. arch.md:158-162 specifies the mapping:
 *   agent_start         → "thinking"
 *   agent_end           → "idle"
 *   tool_execution_start → `tool:<toolName>`
 *
 * Events that don't map (session_start, session_shutdown) are ignored.
 * Send failures are swallowed: status updates are advisory, and the bus
 * client reconnects on its own.
 */
export async function forwardAgentStatus(
  deps: ForwardAgentStatusDeps,
  input: ForwardAgentStatusInput,
): Promise<void> {
  const status = mapEventToStatus(input.event);
  if (status === undefined) return;
  const message: AgentStatus = {
    kind: "agent_status",
    agentId: input.agentId,
    status,
  };
  try {
    await deps.busClient.send(JSON.stringify(message));
  } catch {
    // bus is offline; reconnect loop owns recovery
  }
}

function mapEventToStatus(event: WorkerPiEvent): WorkerStatus | undefined {
  switch (event.type) {
    case "agent_start":
      return "thinking";
    case "agent_end":
      return "idle";
    case "tool_execution_start":
      return `tool:${event.toolName}`;
    case "session_start":
    case "session_shutdown":
      return undefined;
  }
}
