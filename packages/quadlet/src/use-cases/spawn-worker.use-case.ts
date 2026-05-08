import { isValidAgentId } from "@serisium/embercleave-protocol";
import type { FilesystemPort } from "../adapters/filesystem.port.js";
import type { SystemdUserPort } from "../adapters/systemd-user.port.js";
import { serializeEnvFile } from "../domain/env-file.js";
import { instancePaths } from "../domain/instance-paths.js";

export interface SpawnWorkerDeps {
  readonly systemd: SystemdUserPort;
  readonly fs: FilesystemPort;
  readonly home: string;
}

export interface SpawnWorkerInput {
  readonly agentId: string;
  readonly model?: string;
  readonly initialPrompt?: string;
}

export type SpawnWorkerResult =
  | { readonly spawned: true; readonly unit: string; readonly workspaceDir: string }
  | { readonly spawned: false; readonly reason: "invalid_agent_id" };

export const WORKER_UNIT_PREFIX = "embercleave-worker@";

/**
 * Spawn a worker by writing the per-instance env file, ensuring the
 * workspace directory, and starting the templated systemd unit
 * (arch.md:218-221).
 */
export async function spawnWorker(
  deps: SpawnWorkerDeps,
  input: SpawnWorkerInput,
): Promise<SpawnWorkerResult> {
  if (!isValidAgentId(input.agentId)) {
    return { spawned: false, reason: "invalid_agent_id" };
  }
  const paths = instancePaths(input.agentId, deps.home);
  const env: Record<string, string> = {};
  if (input.model !== undefined) env.EMBERCLEAVE_MODEL = input.model;
  if (input.initialPrompt !== undefined) {
    env.EMBERCLEAVE_INITIAL_PROMPT = input.initialPrompt;
  }
  await deps.fs.writeFile(paths.envFile, serializeEnvFile(env));
  await deps.fs.ensureDir(paths.workspaceDir);
  const unit = `${WORKER_UNIT_PREFIX}${input.agentId}.service`;
  await deps.systemd.start(unit);
  return { spawned: true, unit, workspaceDir: paths.workspaceDir };
}
