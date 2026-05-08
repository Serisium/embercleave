import type { WorkerRecord } from "./worker-record.js";

/** Pure transformation: registry contents → human-readable display rows. */
export function renderStatusRows(workers: readonly WorkerRecord[], now: number): string[] {
  if (workers.length === 0) return ["embercleave: no workers"];
  const sorted = [...workers].sort((a, b) => a.agentId.localeCompare(b.agentId));
  const rows = ["embercleave workers:"];
  for (const w of sorted) {
    const live = w.clientId !== undefined ? "●" : "○";
    const status = w.status ?? "unknown";
    const seen = formatRelative(now - w.lastSeen);
    rows.push(`  ${live} ${w.agentId.padEnd(20)}  ${status.padEnd(12)}  (${seen})`);
  }
  return rows;
}

function formatRelative(ms: number): string {
  if (ms < 1000) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
