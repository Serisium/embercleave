# Ordering, dependencies, and restart policy

Two orthogonal dimensions in `[Unit]`:

1. **Ordering** — _when_ does A start relative to B? (`After=`, `Before=`)
2. **Dependency** — _does_ starting A imply starting B? Does stopping B affect A? (`Requires=`, `Wants=`, `Requisite=`, `BindsTo=`, `PartOf=`, `Upholds=`, `OnFailure=`, `OnSuccess=`)

A common mistake is using one when you wanted the other. `After=foo.service` does not start `foo.service`; it only orders. `Requires=foo.service` does not order; pair it with `After=` if you also need ordering.

## The dependency matrix

For a unit U declaring a directive against a target T:

| Directive | Start T when U starts? | Stop U when T stops? | Stop U when T disappears unexpectedly? | U fails if T fails? |
|-----------|------------------------|----------------------|----------------------------------------|---------------------|
| `Wants=T` | Yes (best-effort) | No | No | No |
| `Requires=T` | Yes | Yes | No | Yes (if `After=T` is set) |
| `Requisite=T` | No (T must already be active; else U fails immediately) | Yes | No | Yes |
| `BindsTo=T` | Yes | Yes | **Yes** | Yes |
| `PartOf=T` | **No** | Yes | No | No |
| `Upholds=T` | Continuously restarts T while U is up | No | No | No |

Reverse forms also exist (`WantedBy=`, `RequiredBy=`, etc.) — they declare the dependency from T's `[Install]` section toward U. `WantedBy=multi-user.target` is the canonical "auto-start at boot" idiom for system units; for user units, `WantedBy=default.target`.

`OnFailure=` and `OnSuccess=` activate listed units when U enters `failed` / `inactive(success)`. Used for paging/alerting/cleanup hooks; not a substitute for `Restart=`.

## When to pick which (pi swarm contexts)

- **`pi-worker@.container` -> `pi-swarm.target`:** `PartOf=pi-swarm.target`. Stop the target -> stop all workers (ordered shutdown). Start the target -> nothing happens (workers are imperative). This is exactly what we want.
- **`pi-worker@.container` -> `pi-swarm-bus.target`:** `After=pi-swarm-bus.target` only. Workers start after the bus exists, but a worker doesn't bring the bus up — that's the manager's job.
- **`pi-mgr.container` -> `pi-swarm-bus.target`:** `Before=pi-swarm-bus.target` (the manager **provides** the bus). Or have the manager `Require=` the tmpfiles dir setup.
- **Hypothetical: workers must die when the bus disappears mid-run:** `BindsTo=pi-swarm-bus.target` plus `After=pi-swarm-bus.target`. We don't do this in v1 — workers tolerate manager restart per arch.md:259-260.

## Custom .target units

A `.target` is a unit type with no executable; it exists purely as a synchronization point. Define one when you need a name to group, order against, or cascade stops to. A minimal target:

```
# /etc/containers/systemd/pi-swarm.target  (Quadlet — emits a .service-less .target)
# or hand-written /etc/systemd/user/pi-swarm.target
[Unit]
Description=Pi swarm grouping target
StopWhenUnneeded=no
```

`StopWhenUnneeded=no` is explicit insurance: even if no instance currently lists `PartOf=`, the target stays up so future instances bind correctly.

Per arch.md:347 the pi swarm ships such a target for ordered shutdown.

## Restart policy

`[Service] Restart=` values, from least to most aggressive:

| Value | Restart on... |
|-------|---------------|
| `no` | Never. |
| `on-success` | Clean exit (rc=0 or in `SuccessExitStatus=`). Unusual. |
| `on-failure` | Non-zero exit, signal **except** SIGHUP/SIGINT/SIGTERM/SIGPIPE, watchdog hit, timeout. **The pi-worker default.** |
| `on-abnormal` | Signal (excluding the four above), watchdog, timeout — but **not** plain non-zero exit. |
| `on-watchdog` | Only on watchdog timeout. |
| `on-abort` | Only on uncaught signal exit. |
| `always` | Every exit, including SIGTERM (so `systemctl stop` won't keep it down — set `RestartPreventExitStatus=` to break out). |

`SIGTERM` is in the excluded set for `on-failure`, which is why `systemctl --user stop pi-worker@x.service` is final and does not loop.

Related directives:

- `RestartSec=5` — sleep between attempts (default 100ms upstream).
- `RestartSteps=N` — exponential backoff: each attempt multiplies the delay until `RestartMaxDelaySec=`. Default is 0 (constant `RestartSec`).
- `RestartMaxDelaySec=` — cap.
- `SuccessExitStatus=37 SIGUSR1` — extra clean codes/signals.
- `RestartPreventExitStatus=42` — don't restart if exiting with this code (useful for "permanent failure" sentinels).
- `RestartForceExitStatus=33` — force restart even if the policy wouldn't.

### Rate limit: the boot-loop guard

Defaults: `DefaultStartLimitIntervalSec=10s`, `DefaultStartLimitBurst=5`. If a unit attempts to start ≥5 times in a 10 s sliding window, systemd gives up and parks it in `failed` state. Override per-unit:

```
[Unit]
StartLimitIntervalSec=30
StartLimitBurst=10
```

For workers the default is fine — five rapid crashes inside 10 s is genuine breakage; the manager's reconcile path should detect `ActiveState=failed` (visible in `systemctl --user list-units`) and decide whether to clear (`systemctl reset-failed`) and retry, or surface to the operator.

## Sources

- `systemd.unit(5)` — <https://man7.org/linux/man-pages/man5/systemd.unit.5.html>
- `systemd.service(5)` (Restart= section) — <https://man7.org/linux/man-pages/man5/systemd.service.5.html>
- `systemd.target(5)` — <https://man7.org/linux/man-pages/man5/systemd.target.5.html>
- arch.md:282 (`PartOf=pi-swarm.target`), arch.md:296-297 (`Restart=on-failure RestartSec=5`).
