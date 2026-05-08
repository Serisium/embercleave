import { describe, expect, it } from "vitest";
import type { SystemdUnitInfo, SystemdUserPort } from "../src/adapters/systemd-user.port.js";
import { listRunningWorkers } from "../src/use-cases/list-running-workers.use-case.js";

class FixedSystemd implements SystemdUserPort {
  constructor(private readonly fixture: readonly SystemdUnitInfo[]) {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async listUnits(): Promise<readonly SystemdUnitInfo[]> {
    return this.fixture;
  }
}

describe("listRunningWorkers", () => {
  it("parses worker units and extracts the agentId", async () => {
    const systemd = new FixedSystemd([
      {
        name: "embercleave-worker@alice.service",
        active: "active",
        sub: "running",
        description: "embercleave worker alice",
      },
      {
        name: "embercleave-worker@bob.service",
        active: "active",
        sub: "running",
        description: "embercleave worker bob",
      },
    ]);
    const out = await listRunningWorkers({ systemd });
    expect(out.map((w) => w.agentId).sort()).toEqual(["alice", "bob"]);
    expect(out[0]?.unit).toBe("embercleave-worker@alice.service");
  });

  it("ignores unrelated units that match the pattern only loosely", async () => {
    const systemd = new FixedSystemd([
      { name: "embercleave-mgr.service", active: "active", sub: "running", description: "" },
      { name: "unrelated.service", active: "active", sub: "running", description: "" },
    ]);
    const out = await listRunningWorkers({ systemd });
    expect(out).toEqual([]);
  });
});
