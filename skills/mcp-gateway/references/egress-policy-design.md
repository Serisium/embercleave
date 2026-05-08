# Egress policy design surface (v2)

The v2 worker-isolation problem has more decisions than implementation. This file enumerates them so the implementer is not designing on a blank page.

## Threat model assumed

- **Trusted:** the manager process, the bootc host, the swarm user, the Quadlet definitions.
- **Untrusted:** the worker's prompt content, tool call arguments, anything an MCP server returns. A worker may be benign-but-prompt-injected — the same threat surface as a malicious worker.
- **Out of scope:** kernel-level escapes from rootless Podman. arch.md §1 explicitly delegates that to the bootc layer.

## Per-`agentId` allowlists

embercleave already has a stable `agentId` per worker (arch.md §6). The natural policy unit is:

```
agentId X may reach:
  - api.anthropic.com:443
  - api.openai.com:443
  - mcp://service-gator:8080  (scope: github.com/myorg/myrepo:read,push-new-branch)
  - mcp://filesystem-server (scope: roots=/home/swarm/workspaces/X)
```

Two storage patterns to choose between:

1. **Manager-rendered file**, mounted into the gateway container at start. Simple, but rotating policy means restarting the gateway. OK if policy is per-session and sessions are short.
2. **Live-reloading TOML/YAML**, watched via inotify. service-gator already does this. Lets the manager update policy mid-session without bouncing connections.

## DNS vs HTTP vs L4 enforcement

Pick one (or stack them) — they catch different bypasses:

| Layer | What it catches | Bypass |
|---|---|---|
| DNS allowlist (e.g., dnsmasq with `address=/...`) | Wrong hostnames | DNS-over-HTTPS, hardcoded IPs |
| HTTP forward proxy with hostname allowlist | Wrong HTTPS hosts (via SNI / CONNECT target) | Encrypted Client Hello (ECH) eventually |
| L4 / netfilter on destination IP | Wrong IPs | Allowlist drift, CDN IP sharing |
| MCP gateway on tool/argument level | Wrong MCP tool calls | Anything not MCP |

Recommended baseline for embercleave v2: HTTP forward proxy (catches model-provider traffic) + MCP gateway (catches MCP traffic) + worker network namespace with no default route, only routes to those two services. Skip raw DNS allowlisting unless something downstream needs it.

## Audit logging

The gateway is the only place all worker egress is centralized, so it is the right place to log. Minimum log fields per request: timestamp, agentId, destination (host or MCP server+tool), arguments hash, allow/deny decision, response size. Store under `/var/log/pi-swarm/egress/` (image-managed path, written by the gateway container with appropriate volume) — but be aware of arch.md's note that `/var` is a volume not refreshed by `bootc upgrade`, so log rotation and retention must be explicit.

## Integration with Quadlet `Network=`

In v1, worker Quadlets likely use the default Podman network (full egress). In v2, switch to a named Podman network that has no default gateway and contains only the gateway container. Worker `Network=` directive points at that network. This is the lever that makes the gateway non-bypassable: there is no other route out.

```
# pi-worker@.container (sketch, v2)
[Container]
Image=...
Network=pi-swarm-egress.network
# DNS/HTTP_PROXY env vars point at the gateway
Environment=HTTPS_PROXY=http://egress-gateway:3128
Environment=HTTP_PROXY=http://egress-gateway:3128
```

The gateway container itself attaches to both `pi-swarm-egress.network` (where workers can reach it) and the host's external interface (where it can reach the internet).

## Fail-closed by construction

If the gateway crashes, workers should lose all egress. That is correct behavior: better to surface the failure to the manager than to silently let a worker bypass policy. Achieved naturally by the network-namespace approach above — no gateway, no route out.

## Relation to service-gator

service-gator is one possible *backend* behind the MCP-gateway leg, specifically for git/issue-tracker traffic. It is not a substitute for the egress-gateway tier. Architecture would be: worker → MCP gateway → service-gator → real GitHub/GitLab. service-gator scopes the *operations*, MCP gateway scopes *which agentId can talk to service-gator at all* and audits, network namespace scopes everything else.

## Open questions for v2 design

- Do all workers on a pi share one gateway, or one each? (Resource cost vs blast-radius from a compromised gateway.)
- How does the gateway authenticate worker requests? (mTLS via per-worker cert is overkill; a per-worker token mounted by Quadlet `Environment=` is probably enough since workers can't escape their container to read each other's env.)
- Where does model-provider API key live — worker env (current v1), or gateway-only with the gateway injecting `Authorization` headers? Gateway-only is stronger but couples gateway to provider auth schemes.
- Does the gateway need to translate stdio MCP transport to HTTP and back, since workers may have stdio-only MCP clients?
