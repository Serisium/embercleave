# @serisium/embercleave-quadlet

Manager-side pi extension that spawns and stops worker pis via
Quadlet-managed systemd user units. **Manager pi only.** See `arch.md`
§4.4.

## Public API (`src/index.ts`)

`export default` — the pi extension factory. Pi loads it on extension
discovery; the entry registers the LLM-callable tools `swarm_spawn` and
`swarm_stop`.

## Layout

```
src/
  domain/
    instance-paths.ts            # ~/.config/embercleave/instances/<id>.env, ~/embercleave/workspaces/<id>
    env-file.ts                  # KEY=value serialization with strict validation
  use-cases/
    spawn-worker.use-case.ts     # write env file → mkdir workspace → systemctl start
    stop-worker.use-case.ts      # systemctl stop → rm env file → optional rm workspace
    list-running-workers.use-case.ts  # systemctl list-units enumeration
  adapters/
    systemd-user.{port,adapter}.ts   # shells out to `systemctl --user`
    filesystem.{port,adapter}.ts     # node:fs/promises wrapper
    pi-host.{port,adapter}.ts        # only file importing @mariozechner/pi-coding-agent
  framework/
    extension-entry.ts           # default-exported pi factory; DI wiring
test/
  env-file.test.ts
  instance-paths.test.ts
  spawn-worker.test.ts
  stop-worker.test.ts
  list-running-workers.test.ts
```

## Where new functionality goes

- New worker-lifecycle behaviour (e.g. `swarm_restart`) → new
  `<name>.use-case.ts` + register a tool in `framework/extension-entry.ts`.
- Anything that reads container state via the Podman REST socket belongs
  in **@serisium/embercleave-manager** (it's the package with `podman-rest.adapter.ts`),
  not here. Quadlet only manipulates systemd units and the per-instance
  filesystem layout.
- New shell-command adapter → new `<thing>.{port,adapter}.ts`. Inject in
  `framework/extension-entry.ts`.

## Conventions

- The dependency rule is `adapters → use-cases → domain`. `domain/`
  imports nothing outside `domain/` and `@serisium/embercleave-protocol`.
- `pi-host.adapter.ts` is the **only** file that imports
  `@mariozechner/pi-coding-agent`.
- The `embercleave-worker@` unit prefix is the source of truth here.
  arch.md §6 mirrors it; if either is renamed, both must change in lockstep.
- Tools validate `agentId` via `isValidAgentId` from `@serisium/embercleave-protocol`
  before touching systemd or the filesystem (arch.md:229-232).

## Step 8 status

- `swarm_spawn(agentId, model?, initialPrompt?)` writes the env file and
  starts the unit (arch.md:218-221).
- `swarm_stop(agentId, removeWorkspace?)` stops the unit, removes the env
  file, optionally removes the workspace (arch.md:222-223).
- `listRunningWorkers` exists for the manager's reconciliation flow
  (step 9).

Manual smoke test (Linux only): from a manager pi terminal that has
`@serisium/embercleave-quadlet` loaded, ask the LLM to call `swarm_spawn` with
`agentId: "alice"`. Then `systemctl --user list-units 'embercleave-worker@*.service'`
should show `embercleave-worker@alice.service` as `active running`. macOS
does not support `systemctl --user`; use a Linux VM or container.
