import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { AGENT_ID_PATTERN } from "@serisium/embercleave-protocol";
import { type Static, Type } from "typebox";
import { FilesystemAdapter } from "../adapters/filesystem.adapter.js";
import { PiHostAdapter } from "../adapters/pi-host.adapter.js";
import { SystemdUserAdapter } from "../adapters/systemd-user.adapter.js";
import { spawnWorker } from "../use-cases/spawn-worker.use-case.js";
import { stopWorker } from "../use-cases/stop-worker.use-case.js";

const SpawnParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
  model: Type.Optional(Type.String()),
  initialPrompt: Type.Optional(Type.String()),
});
type SpawnParamsType = Static<typeof SpawnParams>;

const StopParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
  removeWorkspace: Type.Optional(Type.Boolean()),
});
type StopParamsType = Static<typeof StopParams>;

const setupQuadlet: ExtensionFactory = (pi: ExtensionAPI) => {
  const piHost = new PiHostAdapter(pi);
  const systemd = new SystemdUserAdapter();
  const fs = new FilesystemAdapter();
  const home = homedir();

  piHost.registerTool({
    name: "swarm_spawn",
    description:
      "Spawn a new worker pi by writing a per-instance env file, creating its workspace directory, and starting the embercleave-worker@<agentId>.service systemd unit. Returns the unit name on success, or 'invalid_agent_id'.",
    parameters: SpawnParams,
    handler: async (raw) => {
      const params = raw as SpawnParamsType;
      try {
        const result = await spawnWorker(
          { systemd, fs, home },
          {
            agentId: params.agentId,
            ...(params.model !== undefined ? { model: params.model } : {}),
            ...(params.initialPrompt !== undefined ? { initialPrompt: params.initialPrompt } : {}),
          },
        );
        return result.spawned ? `ok: ${result.unit}` : `invalid_agent_id: ${params.agentId}`;
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  piHost.registerTool({
    name: "swarm_stop",
    description:
      "Stop a worker pi by stopping its embercleave-worker@<agentId>.service unit and removing its env file. When removeWorkspace is true, also delete the workspace directory.",
    parameters: StopParams,
    handler: async (raw) => {
      const params = raw as StopParamsType;
      try {
        const result = await stopWorker(
          { systemd, fs, home },
          {
            agentId: params.agentId,
            ...(params.removeWorkspace !== undefined
              ? { removeWorkspace: params.removeWorkspace }
              : {}),
          },
        );
        return result.stopped
          ? `ok: stopped ${result.unit}${result.workspaceRemoved ? " (workspace removed)" : ""}`
          : `invalid_agent_id: ${params.agentId}`;
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
};

export default setupQuadlet;
