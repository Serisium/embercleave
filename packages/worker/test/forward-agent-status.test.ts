import { describe, expect, it } from "vitest";
import type { BusClientHandlers, BusClientPort } from "../src/adapters/bus-client.port.js";
import { forwardAgentStatus } from "../src/use-cases/forward-agent-status.use-case.js";

class CapturingBusClient implements BusClientPort {
  sent: string[] = [];
  async connect(_path: string, _h: BusClientHandlers): Promise<void> {}
  async send(line: string): Promise<void> {
    this.sent.push(line);
  }
  async close(): Promise<void> {}
}

describe("forwardAgentStatus", () => {
  const agentId = "alice";

  it("agent_start → thinking", async () => {
    const bus = new CapturingBusClient();
    await forwardAgentStatus({ busClient: bus }, { agentId, event: { type: "agent_start" } });
    expect(bus.sent).toHaveLength(1);
    expect(JSON.parse(bus.sent[0]!)).toEqual({
      kind: "agent_status",
      agentId,
      status: "thinking",
    });
  });

  it("agent_end → idle", async () => {
    const bus = new CapturingBusClient();
    await forwardAgentStatus({ busClient: bus }, { agentId, event: { type: "agent_end" } });
    expect(JSON.parse(bus.sent[0]!)).toEqual({ kind: "agent_status", agentId, status: "idle" });
  });

  it("tool_execution_start → tool:<toolName>", async () => {
    const bus = new CapturingBusClient();
    await forwardAgentStatus(
      { busClient: bus },
      { agentId, event: { type: "tool_execution_start", toolName: "Read" } },
    );
    expect(JSON.parse(bus.sent[0]!)).toEqual({
      kind: "agent_status",
      agentId,
      status: "tool:Read",
    });
  });

  it("session_start is not forwarded (it triggers the connect dance, not a status)", async () => {
    const bus = new CapturingBusClient();
    await forwardAgentStatus(
      { busClient: bus },
      { agentId, event: { type: "session_start", cwd: "/" } },
    );
    expect(bus.sent).toHaveLength(0);
  });

  it("send failures are swallowed (bus reconnect owns recovery)", async () => {
    const bus: BusClientPort = {
      async connect() {},
      async send() {
        throw new Error("nope");
      },
      async close() {},
    };
    await expect(
      forwardAgentStatus({ busClient: bus }, { agentId, event: { type: "agent_start" } }),
    ).resolves.toBeUndefined();
  });
});
