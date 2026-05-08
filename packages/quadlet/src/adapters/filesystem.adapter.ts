import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FilesystemPort } from "./filesystem.port.js";

export class FilesystemAdapter implements FilesystemPort {
  async ensureDir(p: string): Promise<void> {
    await fs.mkdir(p, { recursive: true });
  }

  async writeFile(p: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, { encoding: "utf8" });
  }

  async removeDir(p: string): Promise<void> {
    await fs.rm(p, { recursive: true, force: true });
  }

  async removeFile(p: string): Promise<void> {
    try {
      await fs.unlink(p);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
