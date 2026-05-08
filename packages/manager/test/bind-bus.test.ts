import { describe, expect, it } from "vitest";
import type { BusServerHandlers, BusServerPort } from "../src/adapters/bus-server.port.js";
import { bindBus } from "../src/use-cases/bind-bus.use-case.js";

class FakeBusServer implements BusServerPort {
  socketPath: string | undefined;
  handlers: BusServerHandlers | undefined;

  async bind(socketPath: string, handlers: BusServerHandlers): Promise<void> {
    this.socketPath = socketPath;
    this.handlers = handlers;
  }
  async send(): Promise<void> {}
  async close(): Promise<void> {}
}

describe("bindBus use-case", () => {
  it("delegates to BusServerPort.bind with the provided socket path and handlers", async () => {
    const fake = new FakeBusServer();
    const onClient = (_id: string) => {};
    const onClose = (_id: string) => {};
    const onMessage = (_id: string, _line: string) => {};
    await bindBus(
      { busServer: fake },
      { socketPath: "/tmp/embercleave-test.sock", onClient, onClose, onMessage },
    );
    expect(fake.socketPath).toBe("/tmp/embercleave-test.sock");
    expect(fake.handlers?.onClient).toBe(onClient);
    expect(fake.handlers?.onClose).toBe(onClose);
    expect(fake.handlers?.onMessage).toBe(onMessage);
  });
});
