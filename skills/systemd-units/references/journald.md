# journald reads for the manager extension

`swarm_logs(agentId, lines=100)` (arch.md §4.3) is implemented as a `journalctl` subprocess. This document covers the flags, JSON schema, and performance considerations.

## The base command

```
journalctl --user -u pi-worker@<agentId>.service -n <lines> --output=json --no-pager
```

Flag-by-flag:

- `--user` — read from the per-user journal namespace. Required because workers run under `user@<UID>.service`.
- `-u <unit>` (alias of `--unit=`) — filter by unit. With `--user`, this is automatically translated to `_SYSTEMD_USER_UNIT=<unit>`. Equivalent to `--user-unit=<unit>` (you can use either).
- `-n <N>` — return the most recent N entries (default: 10). Use `-n all` for the full retained journal of the unit.
- `--output=json` — one JSON object per line, all fields included. See schema below.
- `--no-pager` — **mandatory** for non-interactive use. Without it, journalctl invokes `less` if stdout is a TTY, which deadlocks anything that holds the pty.

For follow mode (live tail):

```
journalctl --user -u pi-worker@<agentId>.service -f --output=json --no-pager
```

`-f` (alias `--follow`) blocks and emits new entries as they arrive. Spawn it as a child process and stream stdout line-by-line.

For time-windowed reads:

- `--since="2 hours ago"` / `--since="2026-05-08 10:00:00"`.
- `--until=...`.
- `--cursor=<cursor>` / `--after-cursor=<cursor>` to resume from a `__CURSOR` returned in a previous JSON entry — most reliable form of pagination.

## JSON schema

`--output=json` produces one entry per newline-terminated line. All values are strings (or arrays of strings, for repeated fields). Numbers including timestamps come as decimal strings.

Always-present "trusted" fields (prefixed `_` are set by journald, `__` are computed):

| Field | Meaning |
|-------|---------|
| `__CURSOR` | Opaque cursor for pagination. Pass back via `--after-cursor=`. |
| `__REALTIME_TIMESTAMP` | Microseconds since Unix epoch (string, e.g. `"1714572345678901"`). |
| `__MONOTONIC_TIMESTAMP` | Microseconds since boot. |
| `_BOOT_ID` | 128-bit boot id, hex. |
| `_MACHINE_ID` | /etc/machine-id, hex. |
| `_HOSTNAME` | hostname at log time. |
| `_PID` | PID of the process that emitted. |
| `_UID` / `_GID` | UID/GID of the emitting process. |
| `_COMM` | Process command (basename). |
| `_EXE` | Full path of the executable. |
| `_SYSTEMD_UNIT` | System-mode unit (for user units this is `user@<UID>.service`). |
| `_SYSTEMD_USER_UNIT` | The actual user unit, e.g. `pi-worker@abc.service`. **Use this for filtering.** |
| `_SYSTEMD_SLICE` | Slice the process belongs to. |
| `_SYSTEMD_CGROUP` | Full cgroup path. |
| `MESSAGE` | The log line text. |
| `PRIORITY` | Syslog priority `0`-`7` (string). |
| `SYSLOG_IDENTIFIER` | Usually the process name. |
| `MESSAGE_ID` | UUID-tagged message (only present for known systemd events: unit start, exit, etc.). See `systemd.journal-fields(7)` for the catalog. |

Notes:

- Field values larger than 4096 bytes appear as `null` unless `--all` is passed. For tool stdout (which can dump huge lines from `pi`), include `--all` if you want to preserve the full message.
- Non-UTF8 / binary payloads come as a JSON array of unsigned bytes (e.g. `[72, 101, 108]`). `MESSAGE` from a normal text-emitting worker is always UTF8.
- Repeated fields (uncommon) become a JSON array of strings.

## Sample entry (abbreviated)

```json
{
  "__CURSOR": "s=...;i=2af3;b=...;m=...;t=618d3a..;x=...",
  "__REALTIME_TIMESTAMP": "1714572345678901",
  "__MONOTONIC_TIMESTAMP": "12345678901",
  "_BOOT_ID": "ab12...",
  "_HOSTNAME": "embercleave",
  "PRIORITY": "6",
  "SYSLOG_IDENTIFIER": "node",
  "_PID": "4321",
  "_UID": "1000",
  "_SYSTEMD_USER_UNIT": "pi-worker@abc.service",
  "_SYSTEMD_UNIT": "user@1000.service",
  "MESSAGE": "agent ready, awaiting prompt"
}
```

## Performance

- Random reads (`-n 100`) are O(100) cursor walks, single-millisecond. Cheap.
- `--since` with a far-back timestamp scans linearly; bounded by retention.
- `--follow` is push-based via `inotify`/`sd_journal_wait`; idle cost is zero.
- Avoid invoking `journalctl` per request when tailing many workers — long-lived child processes per-unit beat repeated short-lived ones, mostly because `journalctl` startup re-mmaps the journal files (~5-20 ms each invocation).
- Default user journal storage is `volatile` on Fedora (`/run/log/journal/`); set `Storage=persistent` in `journald.conf` if logs must survive reboots. Embercleave's bootc image should configure this if `swarm_logs` ever needs cross-reboot history.

## Other useful filters

```
journalctl --user PRIORITY=3                # only errors and worse
journalctl --user MESSAGE_ID=<uuid>         # exit codes, watchdog hits, etc.
journalctl --user _PID=4321
journalctl --user --grep='handoff'          # regex on MESSAGE
journalctl --user --list-boots              # boot ids history
```

For the manager's reconcile path: combining `_SYSTEMD_USER_UNIT=pi-worker@abc.service` with `MESSAGE_ID=9d1aaa27d60140bda24c108446f54f63` (process exited) lets you find when each instance last died.

## Sources

- `journalctl(1)` — <https://man7.org/linux/man-pages/man1/journalctl.1.html>
- `systemd.journal-fields(7)` (full field catalog) — <https://man7.org/linux/man-pages/man7/systemd.journal-fields.7.html>
- `journald.conf(5)` — <https://man7.org/linux/man-pages/man5/journald.conf.5.html>
- `sd-journal(3)` (programmatic API, if a child process becomes too costly) — <https://man7.org/linux/man-pages/man3/sd-journal.3.html>
