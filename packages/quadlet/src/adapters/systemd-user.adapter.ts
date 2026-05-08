import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SystemdUnitInfo, SystemdUserPort } from "./systemd-user.port.js";

const execFileAsync = promisify(execFile);

/** Default adapter that shells out to the user's `systemctl`. */
export class SystemdUserAdapter implements SystemdUserPort {
  async start(unit: string): Promise<void> {
    await execFileAsync("systemctl", ["--user", "start", unit]);
  }

  async stop(unit: string): Promise<void> {
    try {
      await execFileAsync("systemctl", ["--user", "stop", unit]);
    } catch (err) {
      // Exit code 5 = unit not loaded — already stopped. Other failures propagate.
      if (isExitCode(err, 5)) return;
      throw err;
    }
  }

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

function isExitCode(err: unknown, code: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}
