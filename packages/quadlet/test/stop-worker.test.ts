import { describe, expect, it } from "vitest";
import type { FilesystemPort } from "../src/adapters/filesystem.port.js";
import type { SystemdUnitInfo, SystemdUserPort } from "../src/adapters/systemd-user.port.js";
import { stopWorker } from "../src/use-cases/stop-worker.use-case.js";

class FakeSystemd implements SystemdUserPort {
  stopped: string[] = [];
  async start(): Promise<void> {}
  async stop(unit: string): Promise<void> {
    this.stopped.push(unit);
  }
  async listUnits(): Promise<readonly SystemdUnitInfo[]> {
    return [];
  }
}

class FakeFs implements FilesystemPort {
  removedFiles: string[] = [];
  removedDirs: string[] = [];
  async ensureDir(): Promise<void> {}
  async writeFile(): Promise<void> {}
  async removeDir(p: string): Promise<void> {
    this.removedDirs.push(p);
  }
  async removeFile(p: string): Promise<void> {
    this.removedFiles.push(p);
  }
}

const HOME = "/home/swarm";

describe("stopWorker", () => {
  it("stops the unit and removes the env file by default", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    const result = await stopWorker({ systemd, fs, home: HOME }, { agentId: "alice" });
    expect(result).toEqual({
      stopped: true,
      unit: "embercleave-worker@alice.service",
      workspaceRemoved: false,
    });
    expect(systemd.stopped).toEqual(["embercleave-worker@alice.service"]);
    expect(fs.removedFiles).toEqual(["/home/swarm/.config/embercleave/instances/alice.env"]);
    expect(fs.removedDirs).toEqual([]);
  });

  it("removes the workspace directory when removeWorkspace is true", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    const result = await stopWorker(
      { systemd, fs, home: HOME },
      { agentId: "alice", removeWorkspace: true },
    );
    expect(result.stopped && result.workspaceRemoved).toBe(true);
    expect(fs.removedDirs).toEqual(["/home/swarm/embercleave/workspaces/alice"]);
  });

  it("rejects an invalid agentId without touching systemd or fs", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    const result = await stopWorker({ systemd, fs, home: HOME }, { agentId: "BAD" });
    expect(result).toEqual({ stopped: false, reason: "invalid_agent_id" });
    expect(systemd.stopped).toEqual([]);
    expect(fs.removedFiles).toEqual([]);
  });
});
