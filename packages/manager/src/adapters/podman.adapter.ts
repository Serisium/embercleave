import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PodmanPort } from "./podman.port.js";

const execFileAsync = promisify(execFile);

export class PodmanAdapter implements PodmanPort {
  async inspectContainer(containerName: string): Promise<unknown> {
    const { stdout } = await execFileAsync(
      "podman",
      ["inspect", "--type=container", containerName],
      {
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const parsed: unknown = JSON.parse(stdout);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    return parsed;
  }
}
