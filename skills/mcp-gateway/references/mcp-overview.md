# MCP overview (gateway-relevant subset)

The Model Context Protocol (MCP) is a JSON-RPC 2.0 protocol that lets an LLM-driven host application call into external "servers" for tools, data, and prompts. Authoritative spec: <https://modelcontextprotocol.io/specification/2025-11-25>. Use the spec, not vendor blog posts, when a detail matters.

## Roles

- **Host** — the LLM application. In embercleave, this is the `pi` worker process.
- **Client** — the connector inside the host that talks to one MCP server. A host typically has many clients, one per configured server.
- **Server** — the thing exposing tools/resources/prompts. The server may be a local subprocess (filesystem, git) or a remote network service.

A gateway sits in the **client → server** wire. To the host it pretends to be a server; to the real backends it pretends to be a client. From the worker's perspective, nothing changes — it still does the `initialize` handshake, calls `tools/list`, and issues `tools/call`. The gateway intercepts those messages and applies policy before forwarding (or rejecting).

## Server-offered features

- **Tools** — functions the model can invoke (`tools/list`, `tools/call`). The MCP spec is explicit that tools represent "arbitrary code execution and must be treated with appropriate caution"; tool annotations and descriptions are untrusted unless from a trusted server. This is exactly the surface a gateway should police.
- **Resources** — data blobs the host can pull (`resources/list`, `resources/read`).
- **Prompts** — templated workflows (`prompts/list`, `prompts/get`).

## Client-offered features (server → client direction)

- **Sampling** — server asks the host to run an LLM call. Relevant to gateway policy because a hostile MCP server could try to recurse the host's API spend.
- **Roots** — server asks for filesystem boundaries.
- **Elicitation** — server asks the host to ask the user for more info.

## Transports

- **stdio** — server is a child process; client speaks JSON-RPC over its stdin/stdout. Gateway insertion: spawn the gateway as the child, have the gateway spawn the real server. Docker MCP Gateway uses this mode.
- **HTTP / Streamable HTTP** — server is a network endpoint. Gateway insertion: trivial reverse proxy. Most enterprise MCP gateways (ContextForge, Traefik) target this transport.
- **SSE** (legacy in some implementations) — server-sent events for streaming. Behaves like HTTP for proxying purposes.

## Where a gateway naturally inserts

For embercleave's worker-isolation goal, the natural choke points are:

1. **Worker-to-MCP-server traffic.** Worker speaks to the gateway over stdio or HTTP; gateway holds the real server connections. Policy: which servers, which tools on those servers, which arguments, audit log per `agentId`.
2. **Worker-to-model-provider traffic** (Anthropic/OpenAI HTTPS). **MCP gateways do not cover this** — it is plain HTTPS, not MCP. Needs a separate egress mechanism (HTTP proxy, netfilter, or Quadlet network restriction). See `egress-policy-design.md`.

## Spec security guidance worth quoting

> The Model Context Protocol enables powerful capabilities through arbitrary data access and code execution paths. With this power comes important security and trust considerations that all implementors must carefully address.

> Tools represent arbitrary code execution and must be treated with appropriate caution. In particular, descriptions of tool behavior such as annotations should be considered untrusted, unless obtained from a trusted server.

The spec itself notes: "MCP itself cannot enforce these security principles at the protocol level." That gap is the gateway's reason to exist.

## URLs

- Spec index: <https://modelcontextprotocol.io>
- Pinned spec: <https://modelcontextprotocol.io/specification/2025-11-25>
- Reference implementations: <https://github.com/modelcontextprotocol>
