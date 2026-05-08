export interface SystemdUnitInfo {
  readonly name: string;
  readonly active: string;
  readonly sub: string;
  readonly description: string;
}

/** Port for shelling out to `systemctl --user` (arch.md §4.4, §9). */
export interface SystemdUserPort {
  /** systemctl --user start <unit>. Resolves on success, throws on non-zero exit. */
  start(unit: string): Promise<void>;
  /** systemctl --user stop <unit>. Idempotent: succeeds on already-stopped. */
  stop(unit: string): Promise<void>;
  /**
   * systemctl --user list-units --all --output=json [pattern]. Returns
   * the parsed JSON entries.
   */
  listUnits(pattern: string): Promise<readonly SystemdUnitInfo[]>;
}
