---
name: mcp-gateway
description: Reference for the deferred v2 worker-egress / MCP-mediation layer in embercleave. Use when designing or implementing per-worker network isolation, restricting what model providers and MCP servers each worker can reach, mediating MCP tool-call traffic for audit or policy, integrating `service-gator` (scope-restricted MCP server for git/Jira tools), evaluating an MCP Gateway (Docker MCP Gateway, IBM mcp-context-forge, Traefik MCP gateway, etc.), or any work that goes beyond what arch.md §1 calls "what rootless Podman + Quadlet provides." Triggers include: per-worker egress, worker isolation policy, MCP gateway, MCP proxy, service-gator, mass-egress restriction, prompt-injection blast-radius reduction, agentId-scoped allowlists, sandboxing beyond rootless Podman, malicious-worker firewalling, Quadlet `Network=` policy. NOT for v1 work — v1 explicitly trusts all workers equally (arch.md §1, §9).
---

# mcp-gateway (deferred v2 worker-isolation layer)

## v1-vs-v2 boundary

v1 has **no per-worker egress restriction**. arch.md §1 lists "Strong sandboxing beyond what rootless Podman + Quadlet provides" as a non-goal and defers "per-worker egress policy via `service-gator` or MCP Gateway" to the roadmap. §8's authority model (workers cannot drive Podman/systemd; only the manager can) says nothing about *outbound* traffic. §9 calls this out: a prompt-injection-compromised worker is currently un-firewalled — it can reach any model provider and any MCP server its credentials allow. This skill is for the v2 work that closes that gap. Do not add gateway plumbing in v1; its cost is not justified until the trust model actually changes.

## `service-gator`

`service-gator` (`github.com/LobsterTrap/service-gator`) is **not** a generic egress firewall. It is an MCP server that runs *outside* the agent sandbox and exposes scope-restricted tools for GitHub, GitLab, Forgejo/Gitea, and JIRA. The agent connects over MCP and can only invoke operations its scope config allows; the underlying `gh`/`glab`/`tea`/`jira` CLIs (holding the real tokens) execute inside service-gator. Scope via CLI flags (`--gh-repo myorg/myrepo:read,push-new-branch,create-draft`) or a TOML `--scope-file` with inotify live-reload. Distributed as `ghcr.io/lobstertrap/service-gator:latest`. It solves a *narrow* problem: scoped git/Jira access for a possibly-hostile worker. It does not stop a worker from talking to OpenAI, Anthropic, or arbitrary MCP servers — that is the broader egress-tier problem.

## MCP Gateway

"MCP Gateway" is a category. The shared shape: a reverse proxy that speaks MCP, sits between worker and downstream MCP servers, and applies auth/allowlisting/audit at the `tools/list`+`call_tool` semantic layer rather than just HTTP. Concrete candidates: **Docker MCP Gateway** (`github.com/docker/mcp-gateway`, runs MCP servers in isolated Docker containers, tool allowlists, stdio or streaming); **IBM ContextForge** (`github.com/IBM/mcp-context-forge`, federates MCP+A2A+REST/gRPC, plugin system, single Docker image or PyPI package); **Traefik MCP Gateway** (commercial, TBAC, session routing). All mediate MCP traffic; **none mediate model-provider HTTPS** (Anthropic, OpenAI). Full per-worker egress containment needs the MCP gateway *plus* something else (HTTP forward proxy, netfilter, or a Quadlet `Network=` pointing at a userland egress proxy).

## Decision points before implementing

1. **Where the gateway sits.** Per-worker sidecar (cleanest scope, more containers); shared on host (one per pi, must distinguish workers by agentId/token); or in-process (rejected — worker is untrusted).
2. **What traffic is mediated.** MCP-only (model-provider egress still wide open); MCP + forced HTTPS proxy; MCP + DNS allowlist (weakest — DoH bypasses). v2 must be explicit about which threat is closed.
3. **How policy is expressed.** Per-`agentId` allowlist file (aligns with arch.md §6 session model and service-gator's pattern); manager-pushed over a control socket; or static per-image (bad — image rebuild per policy change).
4. **Failure mode.** Fail-closed (no gateway → no egress, manager surfaces the error) is the only defensible choice. Achieved naturally if the worker namespace has no route except via the gateway.

## Relation to the §8 authority model

§8 enforces a one-way authority gradient: only the manager touches Podman/systemd. The gateway tier extends that gradient *outward*: only the gateway reaches the open internet on a worker's behalf, and only for policy-allowed traffic. The two compose — Podman/systemd authority via socket permissions and the worker container having no Podman-socket mount; egress authority via the worker's network namespace having no route except to the gateway. Same property both ways: the worker is asked nicely to behave, but misbehavior is not technically possible.

## When to reach for the references

- MCP protocol primitives, transports, and where a gateway naturally inserts: `references/mcp-overview.md`.
- Designing the policy surface (per-agentId allowlists, DNS vs HTTP enforcement, audit logging, Quadlet `Network=` integration): `references/egress-policy-design.md`.
- What `service-gator` is and what it covers: `references/service-gator.md`.
- Comparing concrete gateway implementations: `references/gateway-options.md`.
