import type { Publish } from "@serisium/embercleave-protocol";
import { describe, expect, it } from "vitest";
import type { BusServerHandlers, BusServerPort } from "../src/adapters/bus-server.port.js";
import { TopicRouter } from "../src/domain/topic-router.js";
import { routeTopicMessage } from "../src/use-cases/route-topic-message.use-case.js";

class CapturingBusServer implements BusServerPort {
  sent: Array<{ clientId: string; line: string }> = [];
  async bind(_p: string, _h: BusServerHandlers): Promise<void> {}
  async send(clientId: string, line: string): Promise<void> {
    this.sent.push({ clientId, line });
  }
  async disconnect(): Promise<void> {}
  async close(): Promise<void> {}
}

const makePublish = (overrides: Partial<Publish> = {}): Publish => ({
  kind: "publish",
  agentId: "alice",
  topic: "build",
  payload: { ok: true },
  ...overrides,
});

describe("routeTopicMessage", () => {
  it("does nothing when the topic has no subscribers", async () => {
    const router = new TopicRouter();
    const bus = new CapturingBusServer();
    await routeTopicMessage({ router, busServer: bus }, { publish: makePublish() });
    expect(bus.sent).toEqual([]);
  });

  it("fans out a topic_message to every subscriber, attributing fromAgentId", async () => {
    const router = new TopicRouter();
    router.subscribe("c1", "build");
    router.subscribe("c2", "build");
    router.subscribe("c3", "deploy");
    const bus = new CapturingBusServer();

    await routeTopicMessage({ router, busServer: bus }, { publish: makePublish() });

    const targets = bus.sent.map((s) => s.clientId).sort();
    expect(targets).toEqual(["c1", "c2"]);
    for (const { line } of bus.sent) {
      expect(JSON.parse(line)).toEqual({
        kind: "topic_message",
        topic: "build",
        payload: { ok: true },
        fromAgentId: "alice",
      });
    }
  });

  it("a slow/failing subscriber does not block the others", async () => {
    const router = new TopicRouter();
    router.subscribe("good", "build");
    router.subscribe("bad", "build");

    const bus: BusServerPort = {
      async bind() {},
      async send(clientId) {
        if (clientId === "bad") throw new Error("nope");
      },
      async disconnect() {},
      async close() {},
    };

    await expect(
      routeTopicMessage({ router, busServer: bus }, { publish: makePublish() }),
    ).resolves.toBeUndefined();
  });
});
