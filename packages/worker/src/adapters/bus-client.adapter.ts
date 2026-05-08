import * as net from "node:net";
import { reconnectDelayMs } from "../domain/reconnect-schedule.js";
import type { BusClientHandlers, BusClientPort } from "./bus-client.port.js";

/**
 * UDS-backed bus client with a line-buffered JSONL receiver and an
 * automatic reconnect loop. The first connect is fire-and-forget — the
 * caller is not blocked on bus availability (arch.md §4.2 failure mode).
 */
export class BusClientAdapter implements BusClientPort {
  private socket: net.Socket | undefined;
  private handlers: BusClientHandlers | undefined;
  private socketPath: string | undefined;
  private buffer = "";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  async connect(socketPath: string, handlers: BusClientHandlers): Promise<void> {
    this.socketPath = socketPath;
    this.handlers = handlers;
    this.closed = false;
    this.attempt = 0;
    this.tryConnect();
  }

  async send(line: string): Promise<void> {
    const sock = this.socket;
    if (!sock || sock.destroyed || !sock.writable) {
      throw new Error("bus client is not connected");
    }
    return new Promise<void>((resolve, reject) => {
      sock.write(`${line}\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    const sock = this.socket;
    if (sock) {
      sock.destroy();
      this.socket = undefined;
    }
  }

  private tryConnect(): void {
    if (this.closed) return;
    const path = this.socketPath;
    const handlers = this.handlers;
    if (!path || !handlers) return;

    const sock = net.connect(path);
    this.socket = sock;
    this.buffer = "";

    sock.once("connect", () => {
      this.attempt = 0;
      void Promise.resolve(handlers.onConnect()).catch(() => {});
    });

    sock.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      let nl = this.buffer.indexOf("\n");
      while (nl !== -1) {
        const line = this.buffer.slice(0, nl);
        this.buffer = this.buffer.slice(nl + 1);
        if (line.length > 0) handlers.onMessage(line);
        nl = this.buffer.indexOf("\n");
      }
    });

    // Suppress unhandled "error" — `close` fires next and drives reconnect.
    sock.once("error", () => {});

    sock.on("close", () => {
      this.socket = undefined;
      void Promise.resolve(handlers.onDisconnect()).catch(() => {});
      if (this.closed) return;
      const delay = reconnectDelayMs(this.attempt);
      this.attempt += 1;
      this.reconnectTimer = setTimeout(() => this.tryConnect(), delay);
    });
  }
}
