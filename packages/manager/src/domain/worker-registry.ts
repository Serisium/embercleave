import type { WorkerHello, WorkerStatus } from "@serisium/embercleave-protocol";
import { type WorkerRecord, recordFromHello, recordFromUnit } from "./worker-record.js";

/**
 * In-memory registry of workers known to the manager. Holds full
 * {@link WorkerRecord}s indexed by agentId and a clientId → agentId
 * back-pointer. Mutations produce new records (records remain immutable
 * to make snapshots cheap to share with the widget render path).
 */
export class WorkerRegistry {
  private readonly byAgent = new Map<string, WorkerRecord>();
  private readonly clientToAgent = new Map<string, string>();

  /**
   * Bind `clientId` to `hello.agentId` and (re)create the record. If a
   * different client previously held the agentId (reconnect), drop the
   * stale clientId binding.
   */
  acceptHello(clientId: string, hello: WorkerHello, now: number): void {
    const existing = this.byAgent.get(hello.agentId);
    if (existing?.clientId !== undefined && existing.clientId !== clientId) {
      this.clientToAgent.delete(existing.clientId);
    }
    this.byAgent.set(hello.agentId, recordFromHello(clientId, hello, now));
    this.clientToAgent.set(clientId, hello.agentId);
  }

  /**
   * Register a worker we've discovered via systemd that hasn't said hello
   * yet. arch.md:201-205 calls these "running but unreachable."
   */
  upsertUnreachable(agentId: string, now: number): void {
    const existing = this.byAgent.get(agentId);
    if (existing !== undefined) return;
    this.byAgent.set(agentId, recordFromUnit(agentId, now));
  }

  /** Update the wire status for the worker on `clientId`. No-op for unknown clients. */
  setStatus(clientId: string, status: WorkerStatus, now: number): void {
    const agentId = this.clientToAgent.get(clientId);
    if (agentId === undefined) return;
    const current = this.byAgent.get(agentId);
    if (current === undefined) return;
    this.byAgent.set(agentId, { ...current, status, lastSeen: now });
  }

  /** Drop the binding for `clientId` (transition to unreachable). */
  forgetClient(clientId: string, now: number): void {
    const agentId = this.clientToAgent.get(clientId);
    if (agentId === undefined) return;
    this.clientToAgent.delete(clientId);
    const current = this.byAgent.get(agentId);
    if (current !== undefined) {
      this.byAgent.set(agentId, { ...current, clientId: undefined, lastSeen: now });
    }
  }

  agentIdFor(clientId: string): string | undefined {
    return this.clientToAgent.get(clientId);
  }

  clientIdFor(agentId: string): string | undefined {
    return this.byAgent.get(agentId)?.clientId;
  }

  recordFor(agentId: string): WorkerRecord | undefined {
    return this.byAgent.get(agentId);
  }

  /** Snapshot of all known workers. Order is unspecified. */
  list(): readonly WorkerRecord[] {
    return Array.from(this.byAgent.values());
  }
}
