# MCP Gateway candidate implementations

"MCP Gateway" is a category, not a product. Three candidates worth evaluating for embercleave v2, plus the things they all share.

## What every MCP gateway does

Reverse proxy that speaks MCP. To the worker, it looks like an MCP server. To the real downstream MCP servers, it looks like an MCP client. It applies policy at the JSON-RPC `tools/list` and `tools/call` boundary — semantic, not just HTTP-level. They typically also handle credential injection (downstream API keys held by the gateway, not the worker).

What none of them do: mediate plain HTTPS to model providers. That is a separate forward-proxy problem.

## Docker MCP Gateway

Repo: <https://github.com/docker/mcp-gateway>. Docs: <https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/>.

- CLI plugin (`docker mcp gateway`) that manages MCP server lifecycle and provides unified access.
- Pattern: AI Client → MCP Gateway → MCP Servers (each in an isolated Docker container).
- Modes: **stdio** (one client) or **streaming** with `--port 8080` (many clients).
- Policy: tool allowlisting per server using dot notation; profile-based isolation; secrets routed via Docker Desktop's secrets store.
- **Tradeoff for embercleave:** assumes Docker Desktop / dockerd as the container runtime. embercleave is rootless Podman. Either run it as a regular container (giving up its Docker integration features) or skip in favor of a Podman-native option. The container-isolation features partially overlap with what Quadlet already gives us, so the value-add is mostly the MCP allowlisting layer.

## IBM ContextForge / mcp-context-forge

Repo: <https://github.com/IBM/mcp-context-forge>. Docs: <https://ibm.github.io/mcp-context-forge/>.

- Self-described as "an AI Gateway, registry, and proxy that sits in front of any MCP, A2A, or REST/gRPC APIs, exposing a unified endpoint with centralized discovery, guardrails and management."
- Federates: MCP servers, A2A (agent-to-agent) endpoints, REST/gRPC services translated into MCP tools.
- Ships as a single Docker container or PyPI package (`pip install mcp-contextforge-gateway`); local SQLite database, no external deps to start.
- Has a plugin system (40+ plugins per upstream).
- Fully MCP-compliant server itself, so workers see it as one MCP endpoint.
- **Tradeoff for embercleave:** broadest feature set, possibly more than needed. Single-binary deploy is friendly. The SQLite default works fine for one pi; multi-pi federation would need Redis (also documented).

## Traefik MCP Gateway

Docs: <https://doc.traefik.io/traefik/master/features/>.

- Commercial / enterprise positioning.
- Task-based access control (TBAC), session-aware routing, audit features.
- Built on Traefik, so reverse-proxy story is mature.
- **Tradeoff for embercleave:** licensing and "enterprise AI workflows" framing makes it a poor fit for a self-hosted hobbyist project. Skip unless the project's deployment story changes.

## Roll-your-own

Possible: write a small TypeScript/Go MCP proxy. The MCP wire format is JSON-RPC 2.0 (see `mcp-overview.md`); intercepting it is not exotic. Reasonable when the policy logic is small and the operational surface of an external dependency is not worth it. Bad when MCP-server authentication, OAuth, A2A, or per-tool argument validation start showing up — at that point, reuse one of the above.

## Selection rubric for embercleave v2

| Criterion | Docker MCP Gateway | ContextForge | Traefik MCP | Roll-your-own |
|---|---|---|---|---|
| Rootless Podman friendly | poor (Docker-coupled) | good (plain container) | good | best |
| Per-`agentId` policy | partial (profiles) | yes (plugin) | yes | as written |
| Audit logs | basic | yes | yes | as written |
| Operational footprint | medium | medium | high | low |
| License | OSS | OSS (Apache) | proprietary | own |
| Maturity (2026) | actively developed by Docker | beta | mature | new code |

Default recommendation when the v2 work begins: **prototype with ContextForge** (broadest fit, OSS, Podman-friendly), keep service-gator as a downstream MCP server behind it, and pair both with a separate forward HTTP proxy for model-provider egress. Revisit roll-your-own only if ContextForge's resource use is wrong for a Raspberry Pi class host.

## URLs

- Docker MCP Gateway: <https://github.com/docker/mcp-gateway>
- IBM mcp-context-forge: <https://github.com/IBM/mcp-context-forge>
- ContextForge docs: <https://ibm.github.io/mcp-context-forge/>
- Traefik features index: <https://doc.traefik.io/traefik/master/features/>
- MCP spec: <https://modelcontextprotocol.io/specification/2025-11-25>
