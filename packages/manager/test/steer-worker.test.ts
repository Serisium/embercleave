import { describe, expect, it } from "vitest";
import type { BusServerHandlers, BusServerPort } from "../src/adapters/bus-server.port.js";
import { WorkerRegistry } from "../src/domain/worker-registry.js";
import { steerWorker } from "../src/use-cases/steer-worker.use-case.js";

class CapturingBusServer implements BusServerPort {
  sent: Array<{ clientId: string; line: string }> = [];
  async bind(_p: string, _h: BusServerHandlers): Promise<void> {}
  async send(clientId: string, line: string): Promise<void> {
    this.sent.push({ clientId, line });
  }
  async disconnect(): Promise<void> {}
  async close(): Promise<void> {}
}

const hello = (agentId: string) => ({
  kind: "worker_hello" as const,
  agentId,
  cwd: "/x",
  protocolVersion: "1.0.0",
});

describe("steerWorker", () => {
  it("sends a steer to the worker bound to the agentId", async () => {
    const registry = new WorkerRegistry();
    registry.acceptHello("c-7", hello("alice"), 1);
    const bus = new CapturingBusServer();
    const result = await steerWorker(
      { registry, busServer: bus },
      { agentId: "alice", message: "stop" },
    );
    expect(result).toEqual({ sent: true });
    expect(bus.sent[0]?.clientId).toBe("c-7");
    expect(JSON.parse(bus.sent[0]!.line)).toEqual({ kind: "steer", message: "stop" });
  });

  it("returns unknown_agent when no record exists", async () => {
    const registry = new WorkerRegistry();
    const bus = new CapturingBusServer();
    const result = await steerWorker(
      { registry, busServer: bus },
      { agentId: "ghost", message: "hi" },
    );
    expect(result).toEqual({ sent: false, reason: "unknown_agent" });
  });

  it("returns not_connected when the worker is unreachable", async () => {
    const registry = new WorkerRegistry();
    registry.upsertUnreachable("alice", 1);
    const bus = new CapturingBusServer();
    const result = await steerWorker(
      { registry, busServer: bus },
      { agentId: "alice", message: "hi" },
    );
    expect(result).toEqual({ sent: false, reason: "not_connected" });
  });
});
