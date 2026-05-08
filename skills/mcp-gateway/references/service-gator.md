# service-gator

## Status of this document

Authoritative source located: **<https://github.com/LobsterTrap/service-gator>** (`ghcr.io/lobstertrap/service-gator`). This is the project arch.md is referring to. There is no separate Red Hat / containers-org / "Mario Zechner ecosystem" project by that name; the arch.md mention is this repo. If a future maintainer cannot find it, the search query that worked in 2026-05 was simply `service-gator podman`.

What follows is from the upstream README and project page; verify against current upstream before implementing.

## What it is

service-gator is **an MCP server that exposes scope-restricted tools for git forges and issue trackers**: GitHub, GitLab, Forgejo/Gitea, and JIRA. It is not a generic egress firewall, not a Podman network plugin, and not a proxy for arbitrary HTTPS. It is one specific kind of MCP backend.

## Architecture

Three layers:

1. **Sandboxed agent** (untrusted) — the LLM-driven worker. In embercleave terms, the `pi` worker.
2. **service-gator** (trusted) — runs *outside* the agent's sandbox. Holds the real PATs (`GH_TOKEN`, `JIRA_API_TOKEN`, etc.). Listens for MCP requests.
3. **CLI tools** — `gh`, `glab`, `tea`, `jira`. service-gator shells out to these with the real credentials, after enforcing scope.

The agent never sees the tokens, never reads env vars, never executes the CLIs directly. It can only ask service-gator over MCP, and service-gator decides.

## Scope configuration

CLI flags for simple setups:

```
service-gator \
  --gh-repo myorg/myrepo:read,push-new-branch,create-draft \
  --jira-project MYPROJ:read,create
```

TOML scope files via `--scope-file <path>` for complex setups, with **inotify-based live reload** — update the file (or in Kubernetes, the ConfigMap) and scopes change without restarting the process. This is the property that makes it composable with a manager that wants to grant per-session scope.

## Permission granularity

The notable design choice is separating git operations from platform operations:

- `push-new-branch` — can create/update branches, independent of PR ops.
- `create-draft` — can create PRs/MRs, independent of branch pushes.
- `require-fork` — push operations restricted to forks, prevents accidental pushes to upstream.

This lets you grant "push to your fork, open draft PR upstream" without granting "push directly to upstream main."

## Deployment

Container image: `ghcr.io/lobstertrap/service-gator:latest`. Standard run:

```
podman run -p 8080:8080 \
  -e GH_TOKEN=... \
  -e JIRA_API_TOKEN=... \
  ghcr.io/lobstertrap/service-gator:latest \
  --gh-repo myorg/myrepo:read
```

Speaks MCP over HTTP on the exposed port. Workers configure it as one of their MCP servers.

## Where it fits in embercleave v2

service-gator covers the narrow case: **per-worker scoped access to git forges and Jira**. It does not address:

- Egress to model providers (Anthropic, OpenAI) — out of scope.
- Egress to arbitrary MCP servers — out of scope.
- DNS / HTTP allowlisting at the network layer — out of scope.

So service-gator is a *feature* of v2, not v2 itself. The full picture is:

- network-namespace + Quadlet `Network=` blocks all worker egress except via the gateway tier;
- the MCP gateway routes worker MCP traffic to allowed downstream MCP servers;
- service-gator is one such downstream MCP server, used when the worker needs git/Jira access;
- a forward HTTP proxy handles model-provider traffic.

## URLs

- Repo: <https://github.com/LobsterTrap/service-gator>
- Image: `ghcr.io/lobstertrap/service-gator:latest`
