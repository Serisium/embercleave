export interface SystemdUnitInfo {
  readonly name: string;
  readonly active: string;
  readonly sub: string;
  readonly description: string;
}

/**
 * Read-only port for `systemctl --user list-units` from the manager. The
 * quadlet package owns start/stop; this port is just for reconciliation
 * (arch.md:201-205) and the `swarm_list` fallback.
 */
export interface SystemdUnitsPort {
  listUnits(pattern: string): Promise<readonly SystemdUnitInfo[]>;
}
