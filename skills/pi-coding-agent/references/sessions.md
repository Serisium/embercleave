# Pi sessions and the `--no-session` trade-off

Source: pi README + `docs/session-format.md`. Repo: `https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent`.

## Where sessions live

```
~/.pi/agent/sessions/
```

Organized by working directory — pi maps each `cwd` (canonicalized) to a subdirectory of session JSONL files. Override:

- `PI_CODING_AGENT_SESSION_DIR` — env var.
- `--session-dir <dir>` — per-invocation flag.

## File format (high level)

JSONL (one JSON object per line). Each entry has an `id` and a `parentId`, forming a tree. Forks create new entries pointing at an existing parent, so branching does **not** create new files — one file holds many divergent paths. The "active branch" is whichever leaf is currently being extended.

`pi.appendEntry(customType, data)` lets extensions add custom-typed entries to the same JSONL tree. `ctx.sessionManager.getEntries()` and `getBranch()` read them back.

For the swarm, the worker extension state is **in-memory only** (arch.md:170), so `appendEntry` is not used by `pi-swarm-worker` — and would no-op anyway under `--no-session`.

## What `--no-session` does

`pi --no-session`:
- Does not read any existing session file.
- Does not write a session file.
- Pi behaves normally otherwise — extensions still load, lifecycle events still fire, tools still work.

`ctx.sessionManager.getSessionFile()` returns `undefined` in this mode. Treat that as the signal that persistence is off.

## Resume / fork / continue

| Flag | Behaviour |
|---|---|
| `-c`, `--continue` | Resume the most recent session for the current `cwd`. |
| `-r`, `--resume` | Open an interactive picker. |
| `--session <path\|id>` | Load a specific session (full path or partial UUID). |
| `--fork <path\|id>` | Copy an existing session into a new file in the current project, then open it. |
| `/fork` (TUI command) | Fork from a previous user message on the active branch. Opens the selector; selected prompt becomes the editor's pre-fill on the new branch. |

Forking is **always** a copy at the entry level — the original tree is untouched, the new file starts from the chosen parent's lineage.

## v1 trade-off (arch.md:506-510)

> Worker pi sessions: ephemeral or persistent? Currently `--no-session`. Persistent sessions enable resume-after-restart but complicate cleanup.

What "complicate cleanup" means concretely:

- Worker container restart with persistent sessions: pi finds the prior session for that `cwd` only if `cwd` is identical. If the workspace mount path is stable (it is — `/var/lib/pi-swarm/workers/${agentId}` per arch.md), `--continue` would work, but state from the old worker (in-memory bus connection, registered tools' caches) is gone while the LLM context survives. The resulting hybrid state is hard to reason about.
- `swarm_stop` with `removeWorkspace: true` (arch.md:222) deletes the workspace; the session file in `~/.pi/agent/sessions/` lives outside the workspace, so it would orphan. Cleanup must be coupled.
- arch.md:463-466: "Pi session state: depends on whether the worker started with `--no-session` (v1 default) or a session ID. With `--no-session`, the worker comes back [restart] empty."

The natural future-state plan (not yet implemented):

1. Mount `~/.pi/agent/sessions/` from a per-worker volume so sessions survive container restart but die with `swarm_stop --removeWorkspace`.
2. Use `pi --session $PI_SWARM_AGENT_ID` so the agent id deterministically picks the right file.
3. Have `swarm_stop` delete the session file alongside the workspace when the cleanup flag is set.

## Inferred vs documented

Documented: file location, env var override, `--no-session` ephemerality, fork/continue/resume flag semantics, JSONL tree structure with `id`/`parentId`.

Inferred from arch.md:

- That `pi --session $PI_SWARM_AGENT_ID` is a viable upgrade path. The flag accepts a path or partial UUID — pi does not document accepting an arbitrary opaque identifier as a session name. May need creating the file at `~/.pi/agent/sessions/${cwd-hash}/${PI_SWARM_AGENT_ID}.jsonl` first, or using `--session-dir` plus `--continue`. **Verify before relying on it.**
- That session files are stored outside the workspace and would orphan on `swarm_stop --removeWorkspace`. True given the default `~/.pi/agent/sessions/` location, but a deployment can mount that path elsewhere via `PI_CODING_AGENT_SESSION_DIR`.
