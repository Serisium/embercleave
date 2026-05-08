import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { JournaldPort } from "./journald.port.js";

const execFileAsync = promisify(execFile);

export class JournaldAdapter implements JournaldPort {
  async readUnitLogs(unit: string, lines: number): Promise<readonly string[]> {
    const { stdout } = await execFileAsync(
      "journalctl",
      ["--user", "--user-unit", unit, "--no-pager", `--lines=${lines}`, "--output=cat"],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    if (stdout.length === 0) return [];
    const trimmed = stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
    return trimmed.split("\n");
  }
}
