import { renderStatusRows } from "../domain/status-snapshot.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface RenderStatusWidgetDeps {
  readonly registry: WorkerRegistry;
  readonly setWidget: (content: readonly string[] | undefined) => void;
  readonly now: () => number;
}

/**
 * Compute the widget rows from the registry and push them to pi via
 * `setWidget`. arch.md:191-192. Cheap; safe to call on every state change.
 */
export function renderStatusWidget(deps: RenderStatusWidgetDeps): void {
  const rows = renderStatusRows(deps.registry.list(), deps.now());
  deps.setWidget(rows);
}
