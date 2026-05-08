# `pi-rc-server` bridge design (deferred)

This document sketches the proposed bridge service. It is not built. It exists so that when implementation starts, the boundary against the manager is already settled.

## Position in the system

```
+-----------------------------+        +-------------------+        +-------------+
| pi-manager (Node + ext)     |        | pi-rc-server      |        | RC player   |
|   - bus widget (TUI)        |        | (JVM container)   |        | (any device |
|   - state machine           |        |                   |        |  running    |
|   - WebSocket #1: state     |  --->  |  WS #1 client     |        |  remote-    |
|     (JSON, language-neutral)|        |  RC writer        |  --->  |  player-*)  |
+-----------------------------+        |  WS #2 server     |        +-------------+
                                       |  (binary .rc)     |
                                       +-------------------+
```

WS #1 and WS #2 are deliberately different protocols on different ports.

- **WS #1 (manager → bridge):** JSON state events. The manager extension publishes worker list, status changes, alerts. Schema lives with the manager.
- **WS #2 (bridge → player):** binary `.rc` documents. Each frame is a self-contained `RemoteComposeWriter.encodeToByteArray()` payload, optionally diffed (alpha may add diff support — TBD).

The manager extension never imports anything from `androidx.compose.remote`. The bridge never imports anything from pi-swarm.

## Manager-side contract (already exists in v1)

arch.md §10 calls for the manager extension to add a second consumer alongside the bus widget: a WebSocket server that re-emits state changes the bus widget already consumes. v1 has the structured state and the bus widget; v2 adds the WS server. Concretely the manager exposes (proposed shape):

```
// WS #1 messages
{ "type": "snapshot", "workers": [ { "id":"...", "status":"running", ... } ] }
{ "type": "worker_update", "worker": { ... } }
{ "type": "alert", "level": "warn", "message": "..." }
```

## Bridge components

1. **State client.** Connects to manager WS #1, maintains in-memory worker map. Reconnects with backoff. Treats disconnection as "stale" and renders a banner.
2. **Document builder.** A pure function `(WorkerState) -> ByteArray`. Uses `RemoteComposeWriter` from `remote-creation-jvm` and Compose-style DSL from `remote-creation-compose` if running JVM-with-Android-deps is acceptable, else direct procedural calls on `remote-creation-core`. Output is a `.rc` document representing the current dashboard frame. See `concept.md` for the writer pattern.
3. **Player server.** WS #2 listens for player connections. On connect, sends current document. On state change, sends new document. Click events (action IDs) come back from the player and the bridge translates them into manager commands forwarded over WS #1 (or a sibling control channel).

## Quadlet (sketch — DO NOT DEPLOY YET)

```ini
# /etc/containers/systemd/pi-rc-server.container  (v2, not v1)
[Unit]
Description=embercleave RemoteCompose bridge
Wants=network-online.target
After=network-online.target pi-manager.service

[Container]
Image=localhost/embercleave/pi-rc-server:latest
Exec=/usr/bin/java -jar /app/pi-rc-server.jar
Network=host
# state stream from manager (loopback)
Environment=MANAGER_WS=ws://127.0.0.1:9911/state
# player-facing port
Environment=RC_LISTEN=0.0.0.0:9912
User=swarm

[Service]
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

This Quadlet is *separate* from `pi-manager.container`. Crash isolation: if the bridge OOMs or panics on a malformed RC opcode, the manager keeps running and the bus widget on the manager pi terminal is unaffected. This is exactly the `pi-rc-server.container` Quadlet referenced in arch.md §10.

## Build target

Per `references/artifacts.md`, the bridge is a **JVM service** (no Kotlin/Native artifacts published for `remote-core` as of May 2026). Practical setup:

- Kotlin/JVM, Gradle.
- Dependencies: `androidx.compose.remote:remote-core`, `androidx.compose.remote:remote-creation-core`, `androidx.compose.remote:remote-creation-jvm`. Add `remote-creation-compose` only if the bridge wants Compose-DSL authoring (drags Android deps; may not be worth it).
- Ktor or Vert.x for the two WebSocket endpoints.
- Container base: a small JRE image (e.g. `eclipse-temurin:21-jre-alpine` or fedora's `registry.fedoraproject.org/fedora-minimal` + `java-21-openjdk-headless`).

If GraalVM native-image works against `remote-creation-jvm`, a static binary container becomes possible later. Not the v2 baseline.

## What stays out of the bridge

- Worker scheduling logic. That is the manager's job.
- Persistence of state across restarts. The bridge is purely reactive; it pulls a snapshot from the manager on connect.
- Player authentication. v2 punts on this — assume the RC player is on a trusted LAN. If that changes, terminate WS #2 behind a TLS-terminating proxy.

## When to revisit

- If `remote-core` ships Kotlin/Native (re-check via `references/artifacts.md` procedure), reconsider native binary.
- If RemoteCompose stabilizes past alpha, lock in a version.
- If embercleave grows a non-Android display surface (web kiosk, Compose Desktop dashboard), confirm the chosen surface has an RC player.
