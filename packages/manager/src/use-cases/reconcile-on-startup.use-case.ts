import type { SystemdUnitsPort } from "../adapters/systemd-units.port.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface ReconcileOnStartupDeps {
  readonly systemd: SystemdUnitsPort;
  readonly registry: WorkerRegistry;
  readonly now: () => number;
}

const UNIT_RE = /^embercleave-worker@(.+)\.service$/;

/**
 * On bind, query `systemctl --user list-units 'embercleave-worker@*.service'`
 * and seed the registry with any units we find. Workers reconnect on
 * their own; until then the manager treats them as "running but
 * unreachable" (arch.md:201-205).
 *
 * Returns the agentIds discovered.
 */
export async function reconcileOnStartup(deps: ReconcileOnStartupDeps): Promise<readonly string[]> {
  const units = await deps.systemd.listUnits("embercleave-worker@*.service");
  const out: string[] = [];
  for (const u of units) {
    const m = UNIT_RE.exec(u.name);
    if (m === null) continue;
    const agentId = m[1];
    if (agentId === undefined) continue;
    deps.registry.upsertUnreachable(agentId, deps.now());
    out.push(agentId);
  }
  return out;
}
