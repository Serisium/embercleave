import type { WorkerHello, WorkerStatus } from "@serisium/embercleave-protocol";

/**
 * Full per-worker state held by {@link WorkerRegistry}. Immutable value
 * object; mutators on the registry produce new records.
 */
export interface WorkerRecord {
  readonly agentId: string;
  /** Bus client id when connected; `undefined` for "running but unreachable". */
  readonly clientId: string | undefined;
  readonly cwd: string;
  /** Wire-level status; `undefined` until the worker first reports one. */
  readonly status: WorkerStatus | undefined;
  /** ms since epoch of the last bus event for this worker. */
  readonly lastSeen: number;
}

/** Build the initial record from a hello. */
export function recordFromHello(clientId: string, hello: WorkerHello, now: number): WorkerRecord {
  return {
    agentId: hello.agentId,
    clientId,
    cwd: hello.cwd,
    status: undefined,
    lastSeen: now,
  };
}

/** Build a "running but unreachable" record from a systemd unit name only. */
export function recordFromUnit(agentId: string, now: number): WorkerRecord {
  return {
    agentId,
    clientId: undefined,
    cwd: "",
    status: undefined,
    lastSeen: now,
  };
}
