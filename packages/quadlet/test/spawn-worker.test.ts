import { describe, expect, it } from "vitest";
import type { FilesystemPort } from "../src/adapters/filesystem.port.js";
import type { SystemdUnitInfo, SystemdUserPort } from "../src/adapters/systemd-user.port.js";
import { spawnWorker } from "../src/use-cases/spawn-worker.use-case.js";

class FakeSystemd implements SystemdUserPort {
  started: string[] = [];
  stopped: string[] = [];
  async start(unit: string): Promise<void> {
    this.started.push(unit);
  }
  async stop(unit: string): Promise<void> {
    this.stopped.push(unit);
  }
  async listUnits(): Promise<readonly SystemdUnitInfo[]> {
    return [];
  }
}

class FakeFs implements FilesystemPort {
  files = new Map<string, string>();
  ensuredDirs: string[] = [];
  removed: string[] = [];
  async ensureDir(p: string): Promise<void> {
    this.ensuredDirs.push(p);
  }
  async writeFile(p: string, content: string): Promise<void> {
    this.files.set(p, content);
  }
  async removeDir(p: string): Promise<void> {
    this.removed.push(p);
  }
  async removeFile(p: string): Promise<void> {
    this.files.delete(p);
    this.removed.push(p);
  }
}

const HOME = "/home/swarm";

describe("spawnWorker", () => {
  it("writes the env file, ensures the workspace, and starts the unit", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    const result = await spawnWorker(
      { systemd, fs, home: HOME },
      { agentId: "alice", model: "claude-opus-4-7" },
    );

    expect(result).toEqual({
      spawned: true,
      unit: "embercleave-worker@alice.service",
      workspaceDir: "/home/swarm/embercleave/workspaces/alice",
    });
    expect(fs.files.get("/home/swarm/.config/embercleave/instances/alice.env")).toBe(
      "EMBERCLEAVE_MODEL=claude-opus-4-7\n",
    );
    expect(fs.ensuredDirs).toContain("/home/swarm/embercleave/workspaces/alice");
    expect(systemd.started).toEqual(["embercleave-worker@alice.service"]);
  });

  it("writes both EMBERCLEAVE_MODEL and EMBERCLEAVE_INITIAL_PROMPT when supplied", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    await spawnWorker(
      { systemd, fs, home: HOME },
      { agentId: "alice", model: "m1", initialPrompt: "build the thing" },
    );
    const env = fs.files.get("/home/swarm/.config/embercleave/instances/alice.env");
    expect(env).toContain("EMBERCLEAVE_MODEL=m1");
    expect(env).toContain("EMBERCLEAVE_INITIAL_PROMPT=build the thing");
  });

  it("writes an empty env file when no per-instance overrides are provided", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    await spawnWorker({ systemd, fs, home: HOME }, { agentId: "bob" });
    expect(fs.files.get("/home/swarm/.config/embercleave/instances/bob.env")).toBe("\n");
  });

  it("rejects an invalid agentId without touching systemd or fs", async () => {
    const systemd = new FakeSystemd();
    const fs = new FakeFs();
    const result = await spawnWorker({ systemd, fs, home: HOME }, { agentId: "Bad ID!" });
    expect(result).toEqual({ spawned: false, reason: "invalid_agent_id" });
    expect(systemd.started).toEqual([]);
    expect(fs.files.size).toBe(0);
  });
});
