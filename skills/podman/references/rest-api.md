# Podman REST API socket

The manager pi (arch.md:199, 215) reads worker container metadata through
this socket. Workers never see it (arch.md:20).

## Activation

The user-mode systemd unit `podman.socket` ships with the Podman package and
lives at `/usr/lib/systemd/user/podman.socket`. Enable it once per user:

```
systemctl --user enable --now podman.socket
loginctl enable-linger swarm
```

`enable-linger` is mandatory in embercleave: without it, the user manager
exits at logout and the socket disappears, so a reboot would leave the manager
extension unable to call `swarm_inspect`. With linger on, the user systemd
instance starts at boot and the socket is available before any Quadlet starts.

Source: <https://docs.podman.io/en/latest/markdown/podman-system-service.1.html>

## Path

For rootless mode the API listens at:

```
unix://$XDG_RUNTIME_DIR/podman/podman.sock
```

For the `swarm` user with UID 1000 this expands to
`/run/user/1000/podman/podman.sock`. The path is stable as long as the user is
logged in (linger guarantees this).

The rootful socket — `/run/podman/podman.sock` — is **not** used by
embercleave. Nothing in the system runs as root on the Layer 2 plane.

## Two API layers

`podman.socket` exposes two HTTP APIs on the same Unix socket:

1. **Compat API** — Docker Engine v1.40 wire format under `/v1.40/...`.
   Useful only if you have an existing Docker client; missing many Podman
   features.
2. **Libpod API** — Podman-native, richer responses, under
   `/v<version>/libpod/...`. **Use this for embercleave.**

Reference: <https://docs.podman.io/en/latest/_static/api.html>

## Endpoints used by the manager

For `swarm_inspect`:

```
GET /v5.0.0/libpod/containers/<name>/json
```

Returns the same JSON shape as `podman inspect <name>`:

- `Id` (full container ID)
- `Name` (e.g. `systemd-pi-worker@01`)
- `State.Status` — `running` / `exited` / `created` / `paused`
- `State.Running` (bool), `State.Pid`, `State.StartedAt`, `State.FinishedAt`
- `State.ExitCode`, `State.OOMKilled`, `State.Error`
- `RestartCount`
- `Config.Image`, `ImageName`
- `Mounts[]`, `NetworkSettings`, `HostConfig`

For listing all workers (Quadlet extension's reconciliation pass):

```
GET /v5.0.0/libpod/containers/json?all=true&filters={"name":["pi-worker@"]}
```

`filters` is a URL-encoded JSON object. The `name` filter is a substring
match, which is what we want — Quadlet names containers
`systemd-pi-worker@<instance>`.

For events (future use):

```
GET /v5.0.0/libpod/events?stream=true
```

Long-poll endpoint; returns NDJSON.

## Calling from Node.js

Use `undici` over a Unix socket. The agent below targets the rootless socket
and exposes a typed `inspect`:

```ts
import { Agent, request } from "undici";
import { join } from "node:path";

const socketPath = join(
  process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`,
  "podman/podman.sock",
);

const agent = new Agent({
  connect: { socketPath },
});

export async function inspectContainer(name: string) {
  const res = await request(
    `http://d/v5.0.0/libpod/containers/${encodeURIComponent(name)}/json`,
    { dispatcher: agent },
  );
  if (res.statusCode === 404) return null;
  if (res.statusCode !== 200) {
    throw new Error(`podman inspect failed: ${res.statusCode}`);
  }
  return res.body.json();
}
```

The host portion of the URL is irrelevant when `socketPath` is set — `http://d`
is the conventional placeholder.

`got` works too (`got.extend({ enableUnixSockets: true })`), as does the
built-in `node:http` with `socketPath` on the request options.

## Security model

Per the upstream docs: "The API grants full access to all Podman
functionality, and thus allows arbitrary code execution as the user running
the API, with no ability to limit or audit this access."
(<https://docs.podman.io/en/latest/markdown/podman-system-service.1.html>)

In embercleave that user is `swarm`. Holding the socket is equivalent to
running arbitrary code as `swarm`. This is exactly why arch.md:121 forbids
workers from seeing it: a compromised worker that could reach
`/run/user/1000/podman/podman.sock` could spawn its own containers, mount the
host filesystem (within rootless limits), and bypass the Quadlet template.

The current authentication story is "Unix filesystem permissions on the
socket" (arch.md:37 deferral, generalized to Layer 2). The mode is `0660`,
owner `swarm:swarm`. Workers run as the same UID, which is why the socket
path is simply not exposed to them — there is no `Volume=` line for it in
`pi-worker@.container`. Adding one would silently break the authority
boundary; reviewers should treat any such diff as a security finding.

## TCP / network exposure

Not used. embercleave keeps the socket Unix-only. If the manager ever needs
to live on a different host (it won't in v1), use SSH forwarding rather than
a TCP listener — `ssh -L /tmp/podman.sock:/run/user/1000/podman/podman.sock`.

## Sources

- <https://docs.podman.io/en/latest/markdown/podman-system-service.1.html>
- <https://docs.podman.io/en/latest/_static/api.html>
- <https://www.redhat.com/sysadmin/podman-rest-api>
