import { describe, expect, it, vi } from "vitest";
import type { BusClientHandlers, BusClientPort } from "../src/adapters/bus-client.port.js";
import type {
  BeforeAgentStartHandler,
  PiHostPort,
  PiToolDefinition,
  WorkerPiEvent,
} from "../src/adapters/pi-host.port.js";
import { handleSteer } from "../src/use-cases/handle-steer.use-case.js";
import { requestHandoff } from "../src/use-cases/request-handoff.use-case.js";

class StubPiHost implements PiHostPort {
  sent: string[] = [];
  onEvent(_h: (event: WorkerPiEvent) => void): void {}
  registerTool(_d: PiToolDefinition): void {}
  onBeforeAgentStart(_h: BeforeAgentStartHandler): void {}
  sendUserMessage(text: string): void {
    this.sent.push(text);
  }
}

class CapturingBusClient implements BusClientPort {
  lines: string[] = [];
  async connect(_p: string, _h: BusClientHandlers): Promise<void> {}
  async send(line: string): Promise<void> {
    this.lines.push(line);
  }
  async close(): Promise<void> {}
}

describe("handleSteer", () => {
  it("forwards the message to pi.sendUserMessage", () => {
    const piHost = new StubPiHost();
    handleSteer({ piHost }, "stop and summarise");
    expect(piHost.sent).toEqual(["stop and summarise"]);
  });
});

describe("requestHandoff", () => {
  it("sends a handoff_request with reason and context", async () => {
    const bus = new CapturingBusClient();
    await requestHandoff(
      { busClient: bus },
      { agentId: "alice", reason: "stuck", context: "tried X and Y" },
    );
    expect(JSON.parse(bus.lines[0]!)).toEqual({
      kind: "handoff_request",
      agentId: "alice",
      reason: "stuck",
      context: "tried X and Y",
    });
  });
});

// Touch vi to silence unused-import lint on test bundler edge cases.
vi.mock;
