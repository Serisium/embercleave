import { isValidAgentId } from "@serisium/embercleave-protocol";
import type { FilesystemPort } from "../adapters/filesystem.port.js";
import type { SystemdUserPort } from "../adapters/systemd-user.port.js";
import { instancePaths } from "../domain/instance-paths.js";
import { WORKER_UNIT_PREFIX } from "./spawn-worker.use-case.js";

export interface StopWorkerDeps {
  readonly systemd: SystemdUserPort;
  readonly fs: FilesystemPort;
  readonly home: string;
}

export interface StopWorkerInput {
  readonly agentId: string;
  readonly removeWorkspace?: boolean;
}

export type StopWorkerResult =
  | {
      readonly stopped: true;
      readonly unit: string;
      readonly workspaceRemoved: boolean;
    }
  | { readonly stopped: false; readonly reason: "invalid_agent_id" };

/**
 * Stop a worker. Always removes the per-instance env file. Removes the
 * workspace directory only when `removeWorkspace` is true so re-spawning
 * the same agentId can keep its prior state by default (arch.md:222-223).
 */
export async function stopWorker(
  deps: StopWorkerDeps,
  input: StopWorkerInput,
): Promise<StopWorkerResult> {
  if (!isValidAgentId(input.agentId)) {
    return { stopped: false, reason: "invalid_agent_id" };
  }
  const unit = `${WORKER_UNIT_PREFIX}${input.agentId}.service`;
  await deps.systemd.stop(unit);
  const paths = instancePaths(input.agentId, deps.home);
  await deps.fs.removeFile(paths.envFile);
  const removeWorkspace = input.removeWorkspace === true;
  if (removeWorkspace) {
    await deps.fs.removeDir(paths.workspaceDir);
  }
  return { stopped: true, unit, workspaceRemoved: removeWorkspace };
}
