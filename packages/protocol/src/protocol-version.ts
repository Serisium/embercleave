/**
 * Protocol version of the bus wire format. Manager and worker must agree
 * on the major version; mismatch closes the connection on `worker_hello`.
 * See arch.md:141-146.
 */
export const PROTOCOL_VERSION = "1.0.0" as const;

/**
 * Returns true when `local` and `remote` share a SemVer major version.
 * Both inputs must be SemVer strings (e.g. "1.0.0", "1.2.3"). Malformed
 * inputs return false — strict by design.
 */
export function isMajorMatch(local: string, remote: string): boolean {
  const localMajor = parseMajor(local);
  const remoteMajor = parseMajor(remote);
  if (localMajor === null || remoteMajor === null) return false;
  return localMajor === remoteMajor;
}

function parseMajor(version: string): number | null {
  const match = /^(\d+)\./.exec(version);
  if (!match) return null;
  const major = match[1];
  if (major === undefined) return null;
  const n = Number.parseInt(major, 10);
  return Number.isFinite(n) ? n : null;
}
