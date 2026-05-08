# Pi CLI flags relevant to embercleave

Source: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md`. Binary name: `pi` (installed by `npm i -g @mariozechner/pi-coding-agent`).

## Modes

| Flag | Mode | Notes |
|---|---|---|
| (default) | Interactive TUI | Editor + streaming output. The manager runs this. arch.md:519 option (a). |
| `-p`, `--print` | Print | Single response, accepts piped stdin, exits. |
| `--mode json` | JSON | Streams every event as a JSON line on stdout. |
| `--mode rpc` | RPC | LF-delimited JSONL request/response over stdin/stdout. The manager runs this for arch.md:519 option (b) "manager runs in `--mode rpc` and a thin HTTP wrapper exposes it". See `rpc-mode.md`. |

Pi also has SDK mode (importing the package), which is not used by embercleave — every embercleave-controlled pi is a child process.

## Session flags

| Flag | Effect | embercleave usage |
|---|---|---|
| `--no-session` | Ephemeral. Pi neither reads nor writes a session file. | **Worker default** (arch.md:293, arch.md:506). |
| `--session <path\|id>` | Use a specific session file or partial UUID. | Future: `--session $PI_SWARM_AGENT_ID` once persistent sessions land (arch.md:506-510). |
| `--fork <path\|id>` | Copy an existing session into a new file in the current project. | Not used by embercleave v1. |
| `-c`, `--continue` | Resume the most recent session in the current `cwd`. | Not used by workers because each container has a fresh cwd. |
| `-r`, `--resume` | Browse and pick a past session. | Interactive only; not used by embercleave. |
| `--session-dir <dir>` | Override session storage location for this invocation. | Could be set per-worker if persistence is enabled. See also `PI_CODING_AGENT_SESSION_DIR`. |

## Model flags

| Flag | Notes |
|---|---|
| `--provider <name>` | Anthropic, OpenAI, etc. |
| `--model <pattern>` | Model identifier with optional thinking suffix, e.g. `sonnet:high`. |
| `--thinking <level>` | `off \| minimal \| low \| medium \| high \| xhigh`. |

The Quadlet sets these via env vars baked into the per-instance env file (arch.md:219 — `swarm_spawn(agentId, model?, initialPrompt?)`).

## Working directory

Pi uses `process.cwd()` at launch as the project root. The Quadlet template sets `WorkingDirectory=` to the worker's per-instance workspace (e.g. `/var/lib/pi-swarm/workers/${agentId}`) so each worker has an isolated cwd.

`PI_CODING_AGENT_SESSION_DIR` overrides where `~/.pi/agent/sessions/` is rooted. Useful if you want session files inside the workspace volume rather than the container's home.

## The exact worker invocation (arch.md:293)

```
Exec=pi --no-session
```

That's the whole worker boot command. Everything else (model, agent id, initial prompt) flows through env vars and the manager-driven RPC channel — there is no static prompt argument because the worker exists to serve bus messages.

## Flags embercleave does **not** use

- `--print` / `-p` — workers are long-running, not request-response.
- `-r` / `--resume` — interactive picker.
- `--mode json` — the worker extension forwards events to the bus directly, bypassing the JSON-on-stdout channel.

## Verifying the current flag list

`pi --help` against the version pinned in `package.json` is the source of truth. The README is authoritative but lags features by a release or two.
