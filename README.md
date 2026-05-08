# embercleave

Swarm orchestration for [`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)
on a hardened fedora-bootc host.

A manager pi binds a JSONL bus over a Unix domain socket; worker pis
connect, identify, and exchange `publish`/`subscribe` messages, context
snippets, and steering events. Worker lifecycle is owned by Podman
Quadlet-generated systemd user units.

The full architecture lives in [`arch.md`](./arch.md). Read that first.

## Packages

| Package                                   | Where it runs           | Purpose                                                    |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| [`@serisium/embercleave-protocol`](./packages/protocol) | (types-only)            | Wire schemas + agentId validator. Zero IO.                 |
| [`@serisium/embercleave-worker`](./packages/worker)     | every pi instance       | Bus client, status forwarding, snippet injection, swarm tools. |
| [`@serisium/embercleave-manager`](./packages/manager)   | manager pi only         | Bus server, registry, routing, manager LLM tools, status widget. |
| [`@serisium/embercleave-quadlet`](./packages/quadlet)   | manager pi only         | `swarm_spawn` / `swarm_stop` via systemd user units.       |

The deployment-time bootc image (Containerfile, Quadlets, tmpfiles) is
described in `arch.md` §7. The image build is downstream of this repo.

## Develop

Requires Node `>=20.18.1` and pnpm `>=9.15.0` (managed via corepack and
the project's `.nvmrc` / `packageManager`).

```bash
nvm use                    # picks up .nvmrc
corepack enable            # enables pnpm matching packageManager
pnpm install
pnpm -r run build
pnpm -r run test
pnpm lint
```

The repo follows a ports-and-adapters layout per package:
`src/domain/`, `src/use-cases/`, `src/adapters/`, `src/framework/`. The
dependency rule is `adapters → use-cases → domain`, never reversed.
See [`AGENTS.md`](./AGENTS.md) for the full conventions and the skill
index.

## License

MIT
