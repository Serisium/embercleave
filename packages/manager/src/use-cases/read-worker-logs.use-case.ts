import { isValidAgentId } from "@serisium/embercleave-protocol";
import type { JournaldPort } from "../adapters/journald.port.js";

export interface ReadWorkerLogsDeps {
  readonly journald: JournaldPort;
}

export interface ReadWorkerLogsInput {
  readonly agentId: string;
  readonly lines: number;
}

export type ReadWorkerLogsResult =
  | { readonly read: true; readonly lines: readonly string[] }
  | { readonly read: false; readonly reason: "invalid_agent_id" };

/**
 * Tail the worker's journald output for `swarm_logs(agentId, lines)`
 * (arch.md:198).
 */
export async function readWorkerLogs(
  deps: ReadWorkerLogsDeps,
  input: ReadWorkerLogsInput,
): Promise<ReadWorkerLogsResult> {
  if (!isValidAgentId(input.agentId)) return { read: false, reason: "invalid_agent_id" };
  const unit = `embercleave-worker@${input.agentId}.service`;
  const lines = await deps.journald.readUnitLogs(unit, Math.max(1, input.lines));
  return { read: true, lines };
}
