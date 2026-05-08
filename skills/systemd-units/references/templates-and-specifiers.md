# Templates and %-specifiers

## Templated units

A template is a unit file with `@` immediately before the suffix and **no instance name** in the filename: `pi-worker@.service`. It is not directly runnable; you instantiate it: `pi-worker@abc.service`. The string between `@` and `.service` is the **instance name** (`abc`); it becomes `%i`.

Lifecycle:

- The template file lives once on disk; instances are virtual.
- `systemctl --user start pi-worker@abc.service` starts a new instance. No `daemon-reload` is needed (arch.md:228).
- `systemctl --user list-units 'pi-worker@*.service'` enumerates only **active** instances; the template itself never appears.
- `systemctl --user list-unit-files 'pi-worker@.service'` shows the template file (with `STATE=disabled` if not statically enabled).

Instance names should restrict to ASCII alphanumerics, `-`, `_` to avoid escaping headaches. The pi swarm enforces `^[a-z0-9-]+$` (arch.md:225).

## Full %-specifier table

From `systemd.unit(5)`. "User" column shows what the specifier resolves to under `--user` (i.e. when the manager is per-user, not the system PID 1).

| Specifier | Meaning | User | System |
|-----------|---------|------|--------|
| `%a` | Architecture | uname -m | uname -m |
| `%A` | OS image version (`IMAGE_VERSION=`) | os-release | os-release |
| `%b` | Boot ID | /proc/sys/kernel/random/boot_id | same |
| `%B` | OS build ID (`BUILD_ID=`) | os-release | os-release |
| `%C` | Cache root | `$XDG_CACHE_HOME` | `/var/cache` |
| `%d` | Credentials dir | `$CREDENTIALS_DIRECTORY` | same |
| `%E` | Config root | `$XDG_CONFIG_HOME` | `/etc` |
| `%f` | Unescaped `/`-prefixed instance or prefix | as user | as system |
| `%g` | Group name of manager | swarm | root |
| `%G` | GID of manager | (numeric) | 0 |
| `%h` | `$HOME` of manager | `/var/home/swarm` | `/root` |
| `%H` | Hostname at unit load | hostname | hostname |
| `%i` | Instance string (raw, escaped) | `abc` | `abc` |
| `%I` | Instance string with escaping undone | `abc` (no-op for safe chars) | same |
| `%j` | Final dash-separated component of prefix | | |
| `%J` | `%j` unescaped | | |
| `%l` | Short hostname (truncated at first dot) | | |
| `%L` | Log root | `$XDG_STATE_HOME/log` | `/var/log` |
| `%m` | Machine ID | /etc/machine-id | same |
| `%n` | Full unit name | `pi-worker@abc.service` | same |
| `%N` | `%n` minus type suffix | `pi-worker@abc` | same |
| `%o` | OS ID (`ID=`) | os-release | os-release |
| `%p` | Prefix name (before `@`) | `pi-worker` | same |
| `%P` | `%p` unescaped | | |
| `%q` | Pretty hostname (`PRETTY_HOSTNAME=`) | | |
| `%s` | Login shell of manager | /bin/bash | /bin/bash |
| `%S` | State root | `$XDG_STATE_HOME` | `/var/lib` |
| `%t` | Runtime root | `$XDG_RUNTIME_DIR` (= `/run/user/<UID>`) | `/run` |
| `%T` | TMP dir | `$TMPDIR` or `/tmp` | `/tmp` |
| `%u` | Username of manager | `swarm` | `root` |
| `%U` | UID of manager | (numeric) | 0 |
| `%v` | Kernel release (`uname -r`) | | |
| `%V` | Persistent tmp | `$TMPDIR` or `/var/tmp` | `/var/tmp` |
| `%w` | OS version ID (`VERSION_ID=`) | os-release | os-release |
| `%W` | OS variant ID (`VARIANT_ID=`) | os-release | os-release |
| `%y` | Fragment path of unit file | | |
| `%Y` | Directory of `%y` | | |

Used in pi-worker template: `%i` (id), `%h` (HOME for env file path), and implicitly `%t` for runtime dir if needed. arch.md:285-291.

## Escaping rules (`%i` vs `%I`)

systemd-escape transforms arbitrary strings into a name-safe form:

- `/` -> `-`
- ASCII alphanumerics and `_` pass through.
- Everything else -> `\xNN` C-style escape.
- Leading `.` -> `\x2e` (only when first char).

Example: `systemd-escape 'foo/bar baz'` -> `foo-bar\x20baz`.

In a template:

- `%i` is the **literal** instance string as it appears in the unit name (already escape-safe by construction — invalid chars couldn't have ended up there).
- `%I` runs the **inverse** transform on `%i`. So an instance `foo-bar\x20baz` exposed as `%I` becomes `foo/bar baz`.

When does the difference matter?

- The instance contains characters that originally needed escaping (`/`, spaces, `:`). `%i` keeps them mangled; `%I` restores the original.
- For the pi swarm, instance ids match `^[a-z0-9-]+$` and never need escaping, so `%i` and `%I` are identical strings. Use `%i` (cheaper, more obvious). The exception is paths: if a future use needs to recover an original `/`-bearing string from the instance, use `%I` (or `%f` for path-with-leading-slash semantics).

## `systemd-escape` for testing

```
systemd-escape --template=pi-worker@.service abc
   -> pi-worker@abc.service

systemd-escape --template=pi-worker@.service 'foo/bar'
   -> pi-worker@foo-bar.service       # / mangled to -

systemd-escape --unescape 'foo\x20bar'
   -> foo bar
```

## Sources

- `systemd.unit(5)` Specifiers section — <https://man7.org/linux/man-pages/man5/systemd.unit.5.html>
- `systemd-escape(1)` — <https://man7.org/linux/man-pages/man1/systemd-escape.1.html>
- `systemd.exec(5)` (env-var-style specifier overlap) — <https://man7.org/linux/man-pages/man5/systemd.exec.5.html>
