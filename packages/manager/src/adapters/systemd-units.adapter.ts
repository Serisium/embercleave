import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SystemdUnitInfo, SystemdUnitsPort } from "./systemd-units.port.js";

const execFileAsync = promisify(execFile);

export class SystemdUnitsAdapter implements SystemdUnitsPort {
  async listUnits(pattern: string): Promise<readonly SystemdUnitInfo[]> {
    const { stdout } = await execFileAsync("systemctl", [
      "--user",
      "list-units",
      "--output=json",
      "--all",
      pattern,
    ]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: SystemdUnitInfo[] = [];
    for (const entry of parsed) {
      if (entry === null || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      out.push({
        name: typeof e.unit === "string" ? e.unit : "",
        active: typeof e.active === "string" ? e.active : "",
        sub: typeof e.sub === "string" ? e.sub : "",
        description: typeof e.description === "string" ? e.description : "",
      });
    }
    return out;
  }
}
