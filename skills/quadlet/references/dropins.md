# Drop-in overrides

Drop-ins let you layer changes on top of an existing Quadlet without editing it. The Quadlet generator merges the source `.container` (etc.) plus any matching `.d/*.conf` files into the output `.service` at generator time. You then `daemon-reload` to pick up the new merged result.

## Drop-in directory layout

For a regular `foo.container`, Quadlet searches these `.d` directories (later overrides earlier):

1. `container.d/` — applies to **every** `.container` unit (rare; use with care)
2. `foo-.container.d/` — applies to `foo.container` and any `foo-bar.container` (truncated-name hierarchy, similar to systemd's `foo-.service.d/`)
3. `foo.container.d/` — applies only to `foo.container`

For a templated `foo@.container` instantiated as `foo@bar`:

1. `container.d/`
2. `foo-.container.d/`
3. `foo@.container.d/` — applies to **every** instance of the template
4. `foo@bar.container.d/` — applies only to instance `bar`

These directories are searched under each Quadlet source path (`/etc/containers/systemd/`, `~/.config/containers/systemd/`, etc.). Within a single `.d` directory, files are merged in lexical (alphabetical) order — that's why convention is to prefix with two-digit numbers (`10-network.conf`, `20-resources.conf`).

## Override semantics

Drop-ins are merged at the **section/key level**:

- **Single-valued keys** (e.g., `Image=`, `User=`, `WorkingDir=`) — the last value wins.
- **Multi-valued keys** (e.g., `Environment=`, `Volume=`, `Network=`) — values **accumulate** across the source and all drop-ins. To clear and reset a multi-valued key, set it to empty first (`Environment=`) on its own line, then re-add the values you want.
- **Sections** that don't exist in the source can be added by a drop-in. `[Service] Restart=...` in a drop-in works even if the source had no `[Service]` section.

Drop-ins can also reach into systemd's own sections, not just `[Container]`. Adding `[Unit] After=postgres.service` via a drop-in is fine.

## Example: extra volume for one worker

```ini
# ~/.config/containers/systemd/pi-worker@special.container.d/10-extra-volume.conf
[Container]
Volume=%h/secrets:/run/secrets:ro
```

This adds a read-only secrets mount only when starting `pi-worker@special.service`. Other instances are unaffected.

## When drop-ins are appropriate (in the pi swarm)

Use a drop-in when **a single instance** needs structural change (different image, extra volume, different capability set) that can't be expressed as an env var. If the change should apply to all workers, edit the template and rebuild the image.

If you find yourself writing many per-instance drop-ins that look similar, that's a signal you actually have a second class of worker — ship it as a separate template (`pi-researcher@.container`) instead of forking via drop-ins.

## Daemon-reload requirement

Adding, removing, or editing a drop-in `.conf` requires `systemctl --user daemon-reload` (or `systemctl daemon-reload` for system units). The template itself does not need to change; the merged generator output does, and that's only re-derived on reload.

This is one of the two normal triggers for a runtime `daemon-reload` in embercleave (the other being a deliberate template upgrade). Routine spawn/stop of instances does **not** need reload.

## Known issue #26555: drop-in path mixing

If two drop-in files share the same name (e.g., `10-override.conf`) but live in different parent directories — say one under `/etc/containers/systemd/foo-.container.d/` and another under `~/.config/containers/systemd/foo.container.d/` — the merge precedence is buggy when the parents don't share the same filesystem root. Avoid duplicate filenames across parent directories; prefer unique numeric prefixes (`10-`, `20-`, `30-`).

## Sources

- `podman-systemd.unit(5)` (drop-in section): <https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html>
- systemd drop-in semantics (`systemd.unit(5)`): <https://www.freedesktop.org/software/systemd/man/systemd.unit.html>
- Issue #26555 (drop-in path mixing): <https://github.com/containers/podman/issues/26555>
- Issue #27716 (rootless drop-in edge case): <https://github.com/containers/podman/issues/27716>
