import { describe, expect, it } from "vitest";
import type { BusServerHandlers, BusServerPort } from "../src/adapters/bus-server.port.js";
import { WorkerRegistry } from "../src/domain/worker-registry.js";
import { sendSnippet } from "../src/use-cases/send-snippet.use-case.js";

class CapturingBusServer implements BusServerPort {
  sent: Array<{ clientId: string; line: string }> = [];
  async bind(_p: string, _h: BusServerHandlers): Promise<void> {}
  async send(clientId: string, line: string): Promise<void> {
    this.sent.push({ clientId, line });
  }
  async disconnect(): Promise<void> {}
  async close(): Promise<void> {}
}

describe("sendSnippet", () => {
  it("sends a snippet_push to the worker bound to the agentId", async () => {
    const registry = new WorkerRegistry();
    registry.acceptHello(
      "c-7",
      { kind: "worker_hello", agentId: "alice", cwd: "/x", protocolVersion: "1.0.0" },
      1,
    );
    const bus = new CapturingBusServer();
    const result = await sendSnippet(
      { registry, busServer: bus },
      { agentId: "alice", snippetId: "s1", content: "hello" },
    );
    expect(result).toEqual({ sent: true });
    expect(bus.sent).toHaveLength(1);
    expect(bus.sent[0]?.clientId).toBe("c-7");
    expect(JSON.parse(bus.sent[0]!.line)).toEqual({
      kind: "snippet_push",
      snippetId: "s1",
      content: "hello",
    });
  });

  it("returns unknown_agent when no worker is registered for the agentId", async () => {
    const registry = new WorkerRegistry();
    const bus = new CapturingBusServer();
    const result = await sendSnippet(
      { registry, busServer: bus },
      { agentId: "ghost", snippetId: "s1", content: "x" },
    );
    expect(result).toEqual({ sent: false, reason: "unknown_agent" });
    expect(bus.sent).toEqual([]);
  });
});
