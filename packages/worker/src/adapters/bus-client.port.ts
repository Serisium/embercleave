/** Lifecycle handlers the bus client invokes. */
export interface BusClientHandlers {
  readonly onConnect: () => Promise<void> | void;
  readonly onDisconnect: () => Promise<void> | void;
  readonly onMessage: (line: string) => void;
}

/**
 * Port the worker uses to talk to the manager's bus over UDS. Implementations
 * line-buffer JSONL on receive and reconnect on EOF with a fixed backoff
 * schedule (`reconnect-schedule.ts`). arch.md §5, arch.md:154-155.
 */
export interface BusClientPort {
  /**
   * Begin the connect/reconnect loop. Resolves once the loop is running.
   * Connection failures are handled internally; callers do not await
   * actual TCP-level connect.
   */
  connect(socketPath: string, handlers: BusClientHandlers): Promise<void>;
  /** Send a JSONL line. Throws when not currently connected. */
  send(line: string): Promise<void>;
  /** Stop the loop and close any active socket. Idempotent. */
  close(): Promise<void>;
}
