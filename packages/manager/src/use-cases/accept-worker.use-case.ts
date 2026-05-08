import { PROTOCOL_VERSION, type WorkerHello, isMajorMatch } from "@serisium/embercleave-protocol";
import type { BusServerPort } from "../adapters/bus-server.port.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface AcceptWorkerDeps {
  readonly registry: WorkerRegistry;
  readonly busServer: BusServerPort;
  readonly now: () => number;
}

export interface AcceptWorkerInput {
  readonly clientId: string;
  readonly hello: WorkerHello;
}

export type AcceptWorkerResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: "version_mismatch" };

/**
 * Validate `worker_hello` and bind the clientId to the agentId. Major-version
 * mismatch is rejected and the bus disconnects the client (arch.md:141-146).
 */
export async function acceptWorker(
  deps: AcceptWorkerDeps,
  input: AcceptWorkerInput,
): Promise<AcceptWorkerResult> {
  if (!isMajorMatch(PROTOCOL_VERSION, input.hello.protocolVersion)) {
    await deps.busServer.disconnect(input.clientId);
    return { accepted: false, reason: "version_mismatch" };
  }
  deps.registry.acceptHello(input.clientId, input.hello, deps.now());
  return { accepted: true };
}
