import { describe, expect, it } from "vitest";
import type { BusClientHandlers, BusClientPort } from "../src/adapters/bus-client.port.js";
import { publishToTopic } from "../src/use-cases/publish-to-topic.use-case.js";
import { subscribeToTopic } from "../src/use-cases/subscribe-to-topic.use-case.js";

class CapturingBusClient implements BusClientPort {
  sent: string[] = [];
  async connect(_path: string, _h: BusClientHandlers): Promise<void> {}
  async send(line: string): Promise<void> {
    this.sent.push(line);
  }
  async close(): Promise<void> {}
}

describe("publishToTopic", () => {
  it("sends a publish message with topic, payload, and agentId", async () => {
    const bus = new CapturingBusClient();
    await publishToTopic(
      { busClient: bus },
      { agentId: "alice", topic: "build", payload: { ok: true } },
    );
    expect(JSON.parse(bus.sent[0]!)).toEqual({
      kind: "publish",
      agentId: "alice",
      topic: "build",
      payload: { ok: true },
    });
  });
});

describe("subscribeToTopic", () => {
  it("sends a subscribe message with the topic and agentId", async () => {
    const bus = new CapturingBusClient();
    await subscribeToTopic({ busClient: bus }, { agentId: "alice", topic: "build" });
    expect(JSON.parse(bus.sent[0]!)).toEqual({
      kind: "subscribe",
      agentId: "alice",
      topic: "build",
    });
  });
});
