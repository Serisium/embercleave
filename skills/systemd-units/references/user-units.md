# User units, the user manager, linger

## What `--user` actually means

`systemctl --user` and `journalctl --user` talk to a per-user systemd manager (PID 1 for that user's services), not the system PID 1. The user manager is itself a system service named `user@<UID>.service` (a templated system unit, instantiated per logged-in or lingering user). It speaks D-Bus on a private socket inside `$XDG_RUNTIME_DIR`.

Key paths:

- `$XDG_RUNTIME_DIR` = `/run/user/<UID>` (tmpfs, owned by the user, mode 0700, recreated each boot/login).
- `$XDG_RUNTIME_DIR/systemd/private` — D-Bus socket `systemctl --user` connects to.
- `$XDG_RUNTIME_DIR/systemd/user/` — generator output (Quadlet user generator drops `.service` units here).
- `$XDG_RUNTIME_DIR/systemd/generator/` — runtime-generated units (other generators).

Unit file search path, high-to-low precedence (each later entry overrides earlier ones for same unit name):

1. `$XDG_RUNTIME_DIR/systemd/user.control/`
2. `$XDG_RUNTIME_DIR/systemd/user/`
3. `$XDG_CONFIG_HOME/systemd/user/` (= `~/.config/systemd/user/`)
4. `/etc/systemd/user/`
5. `$XDG_RUNTIME_DIR/systemd/user.generated/`
6. `/run/systemd/user/`
7. `/usr/lib/systemd/user/`

Drop-ins (`<unit>.d/*.conf`) are merged from all of the above; later directories override earlier ones key-by-key.

## Lifecycle without linger

Default behaviour without `loginctl enable-linger`:

- First login (any session — local tty, ssh, GUI) starts `user@<UID>.service`.
- Logout of the **last** session triggers shutdown of `user@<UID>.service`, which cascades to every user-mode unit. systemd-logind's `KillUserProcesses=` controls this.
- Boot: nothing happens for users with no active session.

So a worker started over ssh would die when the ssh session closes. A unit `WantedBy=default.target` would never start at boot. This is fundamentally incompatible with the embercleave model.

## What `enable-linger` changes

`loginctl enable-linger <user>` (run as root) writes an empty marker file at `/var/lib/systemd/linger/<user>`. Effects:

1. systemd-logind starts `user@<UID>.service` **at system boot**, before any login.
2. `user@<UID>.service` is **not** stopped when sessions end. It runs until system shutdown (or `disable-linger`).
3. `default.target` for the user is reached at boot, so any unit `WantedBy=default.target` autostarts (this is how `pi-mgr.container` comes up — its Quadlet-generated `.service` has `WantedBy=default.target`).

Verify: `loginctl show-user swarm` shows `Linger=yes`. Or just `ls /var/lib/systemd/linger/`.

In embercleave the bootc image ships `RUN loginctl enable-linger swarm` in the Containerfile (arch.md:380), making linger part of the immutable host state.

## ssh caveat: missing $XDG_RUNTIME_DIR

A common footgun: `ssh swarm@host systemctl --user status pi-worker@x.service` may fail with "Failed to connect to bus: No such file or directory" if the ssh session does not export `XDG_RUNTIME_DIR`. The directory exists (linger), but the env var is unset for non-interactive ssh.

Two fixes:

1. **From the client:** `ssh swarm@host 'XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user status pi-worker@x.service'`.
2. **In the manager process:** the manager extension runs as the swarm user under `user@<UID>.service`, so it inherits `XDG_RUNTIME_DIR` from systemd correctly. Only ad-hoc shells need the fix.

## Useful commands

```
loginctl show-user swarm                # check linger state
systemctl --user daemon-reload          # reload after editing units
systemctl --user list-units --all       # all user units, including inactive
systemctl --user --failed               # only failed
systemctl --user cat pi-worker@abc.service   # effective unit text after generators + drop-ins
systemctl --user show pi-worker@abc.service  # all properties (machine-readable)
```

## Sources

- `loginctl(1)` — <https://man7.org/linux/man-pages/man1/loginctl.1.html>
- `systemd(1)` (User manager section) — <https://man7.org/linux/man-pages/man1/systemd.1.html>
- `systemd.unit(5)` (search path) — <https://man7.org/linux/man-pages/man5/systemd.unit.5.html>
- Arch wiki, `systemd/User` — <https://wiki.archlinux.org/title/Systemd/User>
- arch.md:357 (swarm user creation), arch.md:380 (`enable-linger` in bootc layer).
