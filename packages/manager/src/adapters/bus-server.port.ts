/** Handlers the bus server invokes for each connection lifecycle event. */
export interface BusServerHandlers {
  readonly onClient: (clientId: string) => void;
  readonly onClose: (clientId: string) => void;
  readonly onMessage: (clientId: string, line: string) => void;
}

/**
 * Port the manager uses to host the JSONL bus over a Unix domain socket.
 * Implementations are responsible for line framing on receive, refusing to
 * bind on a live socket, and removing stale socket files. arch.md §5, §4.3.
 */
export interface BusServerPort {
  bind(socketPath: string, handlers: BusServerHandlers): Promise<void>;
  send(clientId: string, line: string): Promise<void>;
  /** Disconnect a single client. No-op when `clientId` is unknown. */
  disconnect(clientId: string): Promise<void>;
  close(): Promise<void>;
}
