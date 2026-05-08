import type { HandoffRequest } from "@serisium/embercleave-protocol";
import type { BusClientPort } from "../adapters/bus-client.port.js";

export interface RequestHandoffDeps {
  readonly busClient: BusClientPort;
}

export interface RequestHandoffInput {
  readonly agentId: string;
  readonly reason: string;
  readonly context: string;
}

/**
 * Send a `handoff_request` to the manager. The manager surfaces it as a
 * synthetic user message in its own session (arch.md:188-194).
 */
export async function requestHandoff(
  deps: RequestHandoffDeps,
  input: RequestHandoffInput,
): Promise<void> {
  const message: HandoffRequest = {
    kind: "handoff_request",
    agentId: input.agentId,
    reason: input.reason,
    context: input.context,
  };
  await deps.busClient.send(JSON.stringify(message));
}
