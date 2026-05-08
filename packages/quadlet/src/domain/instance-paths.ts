import { homedir } from "node:os";
import { join } from "node:path";

export interface InstancePaths {
  readonly envFile: string;
  readonly workspaceDir: string;
}

/**
 * Per-instance paths for an agentId. Layout matches the Quadlet template
 * in arch.md:289-291 and §7 runtime layout (arch.md:402-404).
 */
export function instancePaths(agentId: string, home: string = homedir()): InstancePaths {
  return {
    envFile: join(home, ".config", "embercleave", "instances", `${agentId}.env`),
    workspaceDir: join(home, "embercleave", "workspaces", agentId),
  };
}
