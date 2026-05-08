/** Port for filesystem operations the quadlet use-cases need. */
export interface FilesystemPort {
  /** Recursive mkdir, like `mkdir -p`. */
  ensureDir(path: string): Promise<void>;
  /** Write `content` to `path`, creating parent directories as needed. */
  writeFile(path: string, content: string): Promise<void>;
  /** Recursive remove, like `rm -rf`. Idempotent. */
  removeDir(path: string): Promise<void>;
  /** Remove a file. Idempotent for ENOENT. */
  removeFile(path: string): Promise<void>;
}
