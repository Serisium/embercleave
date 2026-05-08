import { describe, expect, it } from "vitest";
import type { BusServerHandlers, BusServerPort } from "../src/adapters/bus-server.port.js";
import { WorkerRegistry } from "../src/domain/worker-registry.js";
import { acceptWorker } from "../src/use-cases/accept-worker.use-case.js";

class TrackingBusServer implements BusServerPort {
  disconnected: string[] = [];
  async bind(_p: string, _h: BusServerHandlers): Promise<void> {}
  async send(): Promise<void> {}
  async disconnect(clientId: string): Promise<void> {
    this.disconnected.push(clientId);
  }
  async close(): Promise<void> {}
}

const fixedNow = () => 1234;

describe("acceptWorker", () => {
  it("registers a clientId for a hello with a matching major version", async () => {
    const registry = new WorkerRegistry();
    const bus = new TrackingBusServer();
    const result = await acceptWorker(
      { registry, busServer: bus, now: fixedNow },
      {
        clientId: "c1",
        hello: {
          kind: "worker_hello",
          agentId: "alice",
          cwd: "/workspace",
          protocolVersion: "1.2.3",
        },
      },
    );
    expect(result).toEqual({ accepted: true });
    expect(registry.agentIdFor("c1")).toBe("alice");
    expect(registry.recordFor("alice")?.lastSeen).toBe(1234);
    expect(bus.disconnected).toEqual([]);
  });

  it("rejects and disconnects on major-version mismatch", async () => {
    const registry = new WorkerRegistry();
    const bus = new TrackingBusServer();
    const result = await acceptWorker(
      { registry, busServer: bus, now: fixedNow },
      {
        clientId: "c1",
        hello: {
          kind: "worker_hello",
          agentId: "alice",
          cwd: "/workspace",
          protocolVersion: "2.0.0",
        },
      },
    );
    expect(result).toEqual({ accepted: false, reason: "version_mismatch" });
    expect(registry.agentIdFor("c1")).toBeUndefined();
    expect(bus.disconnected).toEqual(["c1"]);
  });
});
