import { describe, expect, it } from "vitest";
import type { SystemdUnitInfo, SystemdUnitsPort } from "../src/adapters/systemd-units.port.js";
import { WorkerRegistry } from "../src/domain/worker-registry.js";
import { reconcileOnStartup } from "../src/use-cases/reconcile-on-startup.use-case.js";

class FixedSystemd implements SystemdUnitsPort {
  constructor(private readonly fixture: readonly SystemdUnitInfo[]) {}
  async listUnits(): Promise<readonly SystemdUnitInfo[]> {
    return this.fixture;
  }
}

describe("reconcileOnStartup", () => {
  it("seeds the registry with one unreachable record per discovered worker unit", async () => {
    const registry = new WorkerRegistry();
    const systemd = new FixedSystemd([
      {
        name: "embercleave-worker@alice.service",
        active: "active",
        sub: "running",
        description: "",
      },
      {
        name: "embercleave-worker@bob.service",
        active: "active",
        sub: "running",
        description: "",
      },
      { name: "unrelated.service", active: "active", sub: "running", description: "" },
    ]);
    const out = await reconcileOnStartup({ systemd, registry, now: () => 1234 });
    expect(out.sort()).toEqual(["alice", "bob"]);
    expect(
      registry
        .list()
        .map((r) => r.agentId)
        .sort(),
    ).toEqual(["alice", "bob"]);
    for (const r of registry.list()) {
      expect(r.clientId).toBeUndefined();
      expect(r.lastSeen).toBe(1234);
    }
  });

  it("does not overwrite a record that's already connected", async () => {
    const registry = new WorkerRegistry();
    registry.acceptHello(
      "c1",
      { kind: "worker_hello", agentId: "alice", cwd: "/x", protocolVersion: "1.0.0" },
      1,
    );
    const systemd = new FixedSystemd([
      {
        name: "embercleave-worker@alice.service",
        active: "active",
        sub: "running",
        description: "",
      },
    ]);
    await reconcileOnStartup({ systemd, registry, now: () => 999 });
    const r = registry.recordFor("alice");
    expect(r?.clientId).toBe("c1");
    expect(r?.lastSeen).toBe(1);
  });
});
