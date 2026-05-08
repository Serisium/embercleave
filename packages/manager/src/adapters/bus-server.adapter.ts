import * as fs from "node:fs/promises";
import * as net from "node:net";
import * as path from "node:path";
import type { BusServerHandlers, BusServerPort } from "./bus-server.port.js";

/**
 * UDS-backed JSONL bus server. One connection per worker. The receive loop
 * is line-buffered: chunks accumulate until a `\n` is observed.
 */
export class BusServerAdapter implements BusServerPort {
  private server: net.Server | undefined;
  private readonly clients = new Map<string, net.Socket>();
  private nextClientId = 0;

  async bind(socketPath: string, handlers: BusServerHandlers): Promise<void> {
    if (this.server !== undefined) {
      throw new Error("BusServerAdapter is already bound");
    }
    await fs.mkdir(path.dirname(socketPath), { recursive: true });
    await this.failIfBusy(socketPath);

    const server = net.createServer((socket) => {
      this.nextClientId += 1;
      const clientId = `c-${this.nextClientId}`;
      this.clients.set(clientId, socket);
      handlers.onClient(clientId);

      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let nl = buffer.indexOf("\n");
        while (nl !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.length > 0) handlers.onMessage(clientId, line);
          nl = buffer.indexOf("\n");
        }
      });

      socket.on("close", () => {
        this.clients.delete(clientId);
        handlers.onClose(clientId);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      server.once("error", onError);
      server.listen(socketPath, () => {
        server.off("error", onError);
        resolve();
      });
    });

    this.server = server;
  }

  async send(clientId: string, line: string): Promise<void> {
    const socket = this.clients.get(clientId);
    if (!socket) throw new Error(`unknown client ${clientId}`);
    return new Promise<void>((resolve, reject) => {
      socket.write(`${line}\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async disconnect(clientId: string): Promise<void> {
    const socket = this.clients.get(clientId);
    if (!socket) return;
    socket.destroy();
    this.clients.delete(clientId);
  }

  async close(): Promise<void> {
    for (const socket of this.clients.values()) socket.destroy();
    this.clients.clear();
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    this.server = undefined;
  }

  /**
   * Refuses to bind on a socket where another server is already listening
   * (arch.md:182-184). Removes a stale socket file when no listener answers.
   */
  private async failIfBusy(socketPath: string): Promise<void> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(socketPath);
    } catch {
      return;
    }
    if (!stat.isSocket()) {
      throw new Error(`refusing to bind: ${socketPath} exists and is not a socket`);
    }
    const live = await new Promise<boolean>((resolve) => {
      const probe = net.connect(socketPath);
      probe.once("connect", () => {
        probe.destroy();
        resolve(true);
      });
      probe.once("error", () => resolve(false));
    });
    if (live) {
      throw new Error(`another bus server is already listening on ${socketPath}`);
    }
    await fs.unlink(socketPath);
  }
}
