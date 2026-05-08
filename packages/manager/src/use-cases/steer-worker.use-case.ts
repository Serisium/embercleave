import type { Steer } from "@serisium/embercleave-protocol";
import type { BusServerPort } from "../adapters/bus-server.port.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface SteerWorkerDeps {
  readonly registry: WorkerRegistry;
  readonly busServer: BusServerPort;
}

export interface SteerWorkerInput {
  readonly agentId: string;
  readonly message: string;
}

export type SteerWorkerResult =
  | { readonly sent: true }
  | { readonly sent: false; readonly reason: "unknown_agent" | "not_connected" };

/**
 * Push a `steer` to a specific worker. Worker handlers call
 * `pi.sendUserMessage` with the `message` text (arch.md:163, §4.2).
 */
export async function steerWorker(
  deps: SteerWorkerDeps,
  input: SteerWorkerInput,
): Promise<SteerWorkerResult> {
  const record = deps.registry.recordFor(input.agentId);
  if (record === undefined) return { sent: false, reason: "unknown_agent" };
  if (record.clientId === undefined) return { sent: false, reason: "not_connected" };
  const message: Steer = { kind: "steer", message: input.message };
  await deps.busServer.send(record.clientId, JSON.stringify(message));
  return { sent: true };
}
