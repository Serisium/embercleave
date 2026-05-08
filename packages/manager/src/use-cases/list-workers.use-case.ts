import type { TopicRouter } from "../domain/topic-router.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface ListWorkersDeps {
  readonly registry: WorkerRegistry;
  readonly router: TopicRouter;
}

export interface ListWorkerSummary {
  readonly agentId: string;
  readonly connected: boolean;
  readonly cwd: string;
  readonly status: string;
  readonly topics: readonly string[];
  readonly lastSeenMsAgo: number;
}

export interface ListWorkersInput {
  readonly now: number;
}

/**
 * Snapshot the worker registry into a JSON-serializable summary for
 * `swarm_list`. arch.md:194.
 */
export function listWorkers(
  deps: ListWorkersDeps,
  input: ListWorkersInput,
): readonly ListWorkerSummary[] {
  const records = deps.registry.list();
  return records
    .map((r) => ({
      agentId: r.agentId,
      connected: r.clientId !== undefined,
      cwd: r.cwd,
      status: r.status ?? "unknown",
      topics: r.clientId !== undefined ? deps.router.topicsFor(r.clientId) : [],
      lastSeenMsAgo: Math.max(0, input.now - r.lastSeen),
    }))
    .sort((a, b) => a.agentId.localeCompare(b.agentId));
}
