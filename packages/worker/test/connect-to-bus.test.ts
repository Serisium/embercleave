import { PROTOCOL_VERSION } from "@serisium/embercleave-protocol";
import { describe, expect, it } from "vitest";
import type { BusClientHandlers, BusClientPort } from "../src/adapters/bus-client.port.js";
import { connectToBus } from "../src/use-cases/connect-to-bus.use-case.js";

class FakeBusClient implements BusClientPort {
  socketPath: string | undefined;
  handlers: BusClientHandlers | undefined;
  sent: string[] = [];
  async connect(socketPath: string, handlers: BusClientHandlers): Promise<void> {
    this.socketPath = socketPath;
    this.handlers = handlers;
  }
  async send(line: string): Promise<void> {
    this.sent.push(line);
  }
  async close(): Promise<void> {}
}

describe("connectToBus", () => {
  it("registers the bus client with the provided socket path", async () => {
    const bus = new FakeBusClient();
    await connectToBus(
      { busClient: bus },
      {
        socketPath: "/tmp/x.sock",
        agentId: "alice",
        cwd: "/workspace",
        onMessage: () => {},
      },
    );
    expect(bus.socketPath).toBe("/tmp/x.sock");
  });

  it("sends a worker_hello on every successful connect", async () => {
    const bus = new FakeBusClient();
    await connectToBus(
      { busClient: bus },
      {
        socketPath: "/tmp/x.sock",
        agentId: "alice",
        cwd: "/workspace",
        onMessage: () => {},
      },
    );
    // Simulate a connect by invoking the captured handler.
    await bus.handlers?.onConnect();

    expect(bus.sent).toHaveLength(1);
    expect(JSON.parse(bus.sent[0]!)).toEqual({
      kind: "worker_hello",
      agentId: "alice",
      cwd: "/workspace",
      protocolVersion: PROTOCOL_VERSION,
    });
  });

  it("re-sends worker_hello after a reconnect", async () => {
    const bus = new FakeBusClient();
    await connectToBus(
      { busClient: bus },
      {
        socketPath: "/tmp/x.sock",
        agentId: "alice",
        cwd: "/workspace",
        onMessage: () => {},
      },
    );
    await bus.handlers?.onConnect();
    await bus.handlers?.onDisconnect();
    await bus.handlers?.onConnect();
    expect(bus.sent).toHaveLength(2);
  });
});
