/**
 * Serialize key=value pairs into a systemd `EnvironmentFile=` body.
 * Reject names that don't match `^[A-Za-z_][A-Za-z0-9_]*$` and any value
 * containing CR or LF (which would be ambiguous to the systemd parser).
 */
export function serializeEnvFile(entries: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`invalid env var name: ${key}`);
    }
    if (value.includes("\n") || value.includes("\r")) {
      throw new Error(`env var ${key} contains a newline; not allowed in EnvironmentFile`);
    }
    lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}
