---
name: systemd-units
description: Author and reason about systemd user units, templated services (foo@.service), %-specifiers, [Unit] ordering and restart policy, tmpfiles.d entries that own /run/pi-swarm/, and journald reads for the embercleave pi swarm. Use when writing or editing pi-worker@.container, pi-mgr.container, pi-swarm.target, pi-swarm.conf under /etc/tmpfiles.d/; when implementing swarm_logs (journalctl) or swarm_list (systemctl list-units enumeration); when picking After=/PartOf=/BindsTo=/Requires=; when tuning Restart=/RestartSec= for worker crash recovery; when explaining loginctl enable-linger for the swarm user; or when debugging why a user unit did not come up at boot.
---

# systemd for the pi swarm

systemd is the supervision and lifecycle layer in embercleave (Layer 2, alongside Podman). Workers are templated **user** services. The manager is a Quadlet user service. `swarm_logs` reads journald; `swarm_list` reconciles by enumerating user units. Sockets live on tmpfs that `systemd-tmpfiles` recreates on every boot.

## Why user units (not system units)

Everything runs as the unprivileged `swarm` user (arch.md:357). `systemctl --user` talks to a per-user systemd whose D-Bus socket is `$XDG_RUNTIME_DIR/systemd/private` (= `/run/user/$UID/systemd/private`). User unit files come from, high-to-low precedence: `$XDG_RUNTIME_DIR/systemd/user/` (Quadlet user generator drops here), `~/.config/systemd/user/` (user overrides, drop-ins), `/etc/systemd/user/`, `/usr/lib/systemd/user/`. User units never need sudo and have their own journal stream queryable with `journalctl --user`. See `references/user-units.md`.

## linger: the reason boot works

Without linger, the user manager exits when the last login session ends — workers would die on logout, and nothing would start at boot because nobody is logged in. `loginctl enable-linger swarm` (arch.md:380) writes `/var/lib/systemd/linger/swarm` with two effects:

1. systemd-logind spawns the swarm user manager **at system boot**, not at first login.
2. The user manager is **not** torn down when sessions end.

Together: `pi-mgr.container` (enabled in [Install]) auto-starts at boot; the manager extension can `systemctl --user start pi-worker@<id>.service` and the unit survives any subsequent ssh disconnect. For ssh, set `XDG_RUNTIME_DIR=/run/user/$(id -u swarm)` so `systemctl --user` finds the manager's bus.

## pi-swarm.target (logical group for shutdown)

A static `.target` unit (arch.md:347) that workers join via `PartOf=pi-swarm.target` (arch.md:282). `PartOf=` is a one-way stop/restart propagator: stopping the target stops every unit that lists it. Use this for ordered shutdown. **Do not** use `Requires=` here — that would also create a forward start dependency, meaning starting the target would try to start the template (which has no instance).

| Want                                       | Use                |
| ------------------------------------------ | ------------------ |
| Ordering only (start A before B)           | `After=` / `Before=` |
| Stop B when A stops (one-way)              | `PartOf=`          |
| Stop B when A goes away unexpectedly       | `BindsTo=`         |
| B refuses to start unless A is running     | `Requisite=`       |
| Strong start dep + stop propagation        | `Requires=` + `After=` |

Full matrix: `references/ordering.md`.

## The tmpfiles.d entry for /run/pi-swarm/

`/run` is tmpfs; everything under it disappears on reboot. arch.md:378 ships `/etc/tmpfiles.d/pi-swarm.conf` so systemd-tmpfiles recreates the socket directory each boot **before** any user manager starts:

```
#Type Path           Mode User  Group Age Argument
d     /run/pi-swarm  0750 swarm swarm -   -
```

`d` = create directory if missing, fix mode/ownership if present. Age `-` = never auto-clean. The manager binds `bus.sock` inside this directory; the worker container bind-mounts the same path read-write (arch.md:290). See `references/tmpfiles.md`.

## swarm_logs: how to read journald

`swarm_logs(agentId, lines=100)` (arch.md §4.3) maps to:

```
journalctl --user -u pi-worker@<agentId>.service -n <lines> --output=json --no-pager
```

One JSON object per line. Always include `--no-pager` from a non-interactive process — otherwise journalctl blocks on a terminal it does not have. Useful fields per entry: `MESSAGE`, `_PID`, `_SYSTEMD_USER_UNIT`, `__REALTIME_TIMESTAMP` (microseconds since epoch, **string**), `PRIORITY`. See `references/journald.md` for the full schema and tailing notes.

Validate `agentId` against `^[a-z0-9-]+$` (arch.md:225) before substitution. Unit-name injection is a real risk.

## swarm_list: reconciling running workers

On manager bind (arch.md §4.3), enumerate workers actually running:

```
systemctl --user list-units 'pi-worker@*.service' --output=json --no-legend
```

`list-units` accepts fnmatch globs; only **instantiated** templates appear (the bare `pi-worker@.service` never shows). Each entry has `unit`, `load`, `active`, `sub`, `description`. Parse the unit name to extract `agentId`. For richer per-unit detail (start time, exec PID, exit codes), follow up with `systemctl --user show <unit>` per instance.

## Restart semantics for worker crash recovery

The template sets `Restart=on-failure`, `RestartSec=5` (arch.md:296-297):

- **on-failure fires** when the worker exits non-zero, is killed by any signal except SIGHUP/SIGINT/SIGTERM/SIGPIPE, or hits a watchdog/timeout. SIGTERM is excluded, so `systemctl --user stop` is final and does not loop.
- **RestartSec=5** = 5 s between attempts.
- **Default rate limit:** `DefaultStartLimitIntervalSec=10s`, `DefaultStartLimitBurst=5`. Five failures in 10 s -> systemd gives up and the unit lands in `failed` state; reconcile must notice (a `failed` unit shows in `list-units` with `ActiveState=failed`).
- After reboots, instances are **not** auto-revived (no `[Install]` autostart for the template, by design — arch.md:299-301). The manager re-spawns them imperatively.

For `on-failure` vs `on-abnormal` vs `always`, see `references/ordering.md`.

## Specifiers cheat sheet

In templates: `%i` = raw instance string, `%I` = same but systemd-escape-unescaped. The pi-worker template uses `%i` everywhere because `agentId` is already in the safe class. Others used here:

- `%h` -> `$HOME` (`/var/home/swarm`) — `EnvironmentFile=-%h/.config/pi-swarm/instances/%i.env` (arch.md:289).
- `%t` -> `$XDG_RUNTIME_DIR` for user units (`/run/user/<UID>`).
- `%n` -> full unit name (`pi-worker@abc.service`).
- `%U` / `%u` -> numeric UID / username of the manager.

Full table + escaping: `references/templates-and-specifiers.md`.

## References

- `references/user-units.md` — user manager lifecycle, `$XDG_RUNTIME_DIR`, ssh caveats, where unit files live.
- `references/templates-and-specifiers.md` — full %-specifier table, `systemd-escape`, when `%i` vs `%I`.
- `references/tmpfiles.md` — file format, type letters, the `/run/pi-swarm/` entry.
- `references/journald.md` — `journalctl` flags for the manager extension, JSON schema, follow performance.
- `references/ordering.md` — Requires/Wants/PartOf/BindsTo/After + restart policy details.
