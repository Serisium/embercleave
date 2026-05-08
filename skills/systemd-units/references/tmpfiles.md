# systemd-tmpfiles for /run/pi-swarm/

## Why we need this

`/run` is a tmpfs mounted by the kernel before systemd starts. Anything we put there does not survive a reboot. The bus socket directory `/run/pi-swarm/` (arch.md:288, arch.md:357-358) needs to exist with the right ownership and mode **before** the swarm user manager starts so the manager can `bind(2)` `bus.sock` inside it.

`systemd-tmpfiles-setup.service` runs early in boot (After `local-fs.target`, well before `user@<UID>.service`). It reads `/etc/tmpfiles.d/*.conf`, `/usr/lib/tmpfiles.d/*.conf`, and `/run/tmpfiles.d/*.conf`, and creates/cleans paths declaratively.

## File format

One whitespace-separated record per line. Comments start with `#`. Columns:

```
#Type Path  Mode  User  Group  Age  Argument
```

A `-` in any column means "default". Trailing columns may be omitted.

## Type letters (the ones that matter here)

| Type | Effect |
|------|--------|
| `d` | Create directory if missing. Adjust mode/ownership if it exists. |
| `D` | Same as `d` but contents wiped on `--remove`. |
| `e` | Don't create; only adjust mode/ownership and clean by age if it exists. |
| `f` | Create regular file if missing (write `Argument` content if given). |
| `f+` | Create file, truncating if it exists. |
| `L` | Create symlink (target = `Argument`). |
| `r` | Remove path (file). |
| `R` | Remove path recursively. |
| `z` / `Z` | Set perms/ownership/SELinux context (Z is recursive). |
| `x` / `X` | Exclude from cleanup (X also excludes the dir itself). |

Modifiers: `+` (truncate/replace if exists), `!` (boot-only — do not run during a system that's already up), `-` (errors are non-fatal), `=` (require existing type to match), `~` (base64-decode argument), `^` (consume credential).

## The pi-swarm entry

From arch.md:378 (`COPY tmpfiles.d/pi-swarm.conf /etc/tmpfiles.d/`):

```
#Type Path           Mode User  Group Age Argument
d     /run/pi-swarm  0750 swarm swarm -   -
```

Reading column-by-column:

- `d` — make the directory at boot if missing; if it exists, fix mode and owner.
- `/run/pi-swarm` — the path. Must be absolute.
- `0750` — owner rwx, group r-x, others none. The bus socket inside it gets created by the manager process under this; ensure the worker container has its UID mapped into the group, or use `0755` if cross-account access is needed.
- `swarm swarm` — the unprivileged user from arch.md:357.
- `-` (Age) — never auto-clean. The default would be no cleanup anyway, but explicit is good.
- `-` (Argument) — none for type `d`.

## Age field syntax (when used)

Time values: integer + unit (`s`, `m`/`min`, `h`, `d`, `w`, `ms`, `us`). Multiple values sum: `1h30m` = 90 minutes. Special:

- `-` — never clean.
- `0` — always cleanable (every cleanup pass deletes everything).
- Prefix `~` on age — only consider files whose **access** time is older (default uses mtime/ctime/atime worst-of).

The pi-swarm directory uses `-` because it must persist for the entire boot.

## Verification commands

```
sudo systemd-tmpfiles --create /etc/tmpfiles.d/pi-swarm.conf  # apply now
ls -ld /run/pi-swarm                                          # confirm mode + owner
systemd-analyze blame | grep tmpfiles                          # boot-time cost
```

## Common pitfalls

1. **Race with the user manager.** `systemd-tmpfiles-setup.service` ordering is fixed and runs before `user@<UID>.service`, so this is safe — but if you ever need a tmpfiles entry **after** another unit, use a drop-in service that calls `systemd-tmpfiles --create <file>` ordered `After=` that unit.
2. **SELinux labels.** On a SELinux-enabled bootc host, the directory may need a context. tmpfiles applies the system policy default automatically; only override with type `Z` if a custom label is needed.
3. **Don't put the socket itself in tmpfiles.d.** The socket is created at runtime by the manager binding to it, not by tmpfiles. The directory is what tmpfiles owns.

## Sources

- `tmpfiles.d(5)` — <https://man7.org/linux/man-pages/man5/tmpfiles.d.5.html>
- `systemd-tmpfiles(8)` — <https://man7.org/linux/man-pages/man8/systemd-tmpfiles.8.html>
- arch.md:378 (the COPY line), arch.md:357-358 (chown of /run/pi-swarm at image build).
