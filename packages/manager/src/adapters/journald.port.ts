/** Read-only journald access for the worker `swarm_logs` tool. */
export interface JournaldPort {
  /**
   * Return the last `lines` log lines for the user unit `unit`. Each
   * entry is a single line (already concatenated when journalctl
   * splits). Returns an empty array when the unit has no logs.
   */
  readUnitLogs(unit: string, lines: number): Promise<readonly string[]>;
}
