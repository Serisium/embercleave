import type { SystemdUserPort } from "../adapters/systemd-user.port.js";
import { WORKER_UNIT_PREFIX } from "./spawn-worker.use-case.js";

export interface ListRunningWorkersDeps {
  readonly systemd: SystemdUserPort;
}

export interface RunningWorker {
  readonly agentId: string;
  readonly unit: string;
  readonly active: string;
  readonly sub: string;
}

const UNIT_RE = /^embercleave-worker@(.+)\.service$/;

/**
 * Enumerate all worker units (running, dead, etc.). The manager's bus
 * registry is the source of truth for live workers; this is the fallback
 * arch.md:201-205 calls "running but unreachable."
 */
export async function listRunningWorkers(
  deps: ListRunningWorkersDeps,
): Promise<readonly RunningWorker[]> {
  const units = await deps.systemd.listUnits(`${WORKER_UNIT_PREFIX}*.service`);
  const out: RunningWorker[] = [];
  for (const u of units) {
    const m = UNIT_RE.exec(u.name);
    if (m === null) continue;
    const agentId = m[1];
    if (agentId === undefined) continue;
    out.push({ agentId, unit: u.name, active: u.active, sub: u.sub });
  }
  return out;
}
