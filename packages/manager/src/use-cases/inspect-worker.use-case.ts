import { isValidAgentId } from "@serisium/embercleave-protocol";
import type { PodmanPort } from "../adapters/podman.port.js";

export interface InspectWorkerDeps {
  readonly podman: PodmanPort;
}

export interface InspectWorkerInput {
  readonly agentId: string;
}

export type InspectWorkerResult =
  | { readonly inspected: true; readonly data: unknown }
  | { readonly inspected: false; readonly reason: "invalid_agent_id" };

/**
 * `podman inspect` for the worker's container by name (arch.md:199, §4.4).
 * The container name comes from the Quadlet template
 * `ContainerName=embercleave-worker-%i`.
 */
export async function inspectWorker(
  deps: InspectWorkerDeps,
  input: InspectWorkerInput,
): Promise<InspectWorkerResult> {
  if (!isValidAgentId(input.agentId)) {
    return { inspected: false, reason: "invalid_agent_id" };
  }
  const container = `embercleave-worker-${input.agentId}`;
  const data = await deps.podman.inspectContainer(container);
  return { inspected: true, data };
}
