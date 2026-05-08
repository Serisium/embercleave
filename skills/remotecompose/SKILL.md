---
name: remotecompose
description: Reference for RemoteCompose (AndroidX `androidx.compose.remote`) and the deferred embercleave RC bridge service. DEFERRED v2 FEATURE — load only when the user explicitly mentions RemoteCompose, RC, the `.rc` document format, or the planned `pi-rc-server.container` bridge. v1 has no UI service; the bus widget on the manager pi terminal is the control plane. Use when designing or implementing the WebSocket bridge that subscribes to manager state and authors `.rc` documents, when choosing between Kotlin/JVM, Kotlin/Native, or a TS port for the bridge, when investigating whether `remote-core` publishes Kotlin/Native artifacts (the open question in arch.md §10), or when authoring the Quadlet for `pi-rc-server.container`. Triggers: RemoteCompose, remote-compose, remote-core, remote-creation, remote-player, RemoteComposeWriter, .rc document, RC player, pi-rc-server, RC bridge, server-driven UI on the bootc host. Do NOT load for general UI/Compose work or for the manager extension itself.
---

# RemoteCompose for embercleave

## Status: DEFERRED from v1

arch.md §1 lists the RemoteCompose UI server as out of scope and tracked separately. v1 ships only the bus widget on the manager pi's terminal session — the operator SSHes in, the bus widget runs there, and that is the entire control plane. The RC server is **architecturally accommodated** (arch.md §10) but **not built**.

Do not add RC code to the v1 manager extension. Do not create the `pi-rc-server.container` Quadlet until that work is explicitly scheduled. This skill exists so that when implementation does start, the agent has the project's prior decisions immediately at hand.

## What RemoteCompose is

AndroidX framework (`androidx.compose.remote`, `1.0.0-alpha010` as of May 2026) that captures Compose draw/layout calls into a **compact binary document** (`.rc`) for network transmission and native replay by an RC player. Closer to "serialized Compose canvas" than to JSON-described UI — no schema, no WebView, no DOM. A *writer* (plain JVM) builds it; a *player* (Android View, Compose, Glance, or WIP desktop) renders it. See `references/concept.md`.

## The architectural seam (arch.md §10)

```
manager extension  --(WebSocket: JSON state)-->  pi-rc-server  --(WebSocket: .rc bytes)-->  RC player
```

Three rules, all load-bearing:

1. **The manager extension never touches the `.rc` format.** It emits structured state (worker list, status changes) as JSON over a WebSocket. That is a stable, language-neutral contract.
2. **The bridge is a separate Quadlet** (`pi-rc-server.container`). Crash isolation, independent update cycle, swappable. If the RC ecosystem dies or we change minds, only the bridge gets replaced.
3. **The bridge is the only thing that authors `.rc`.** It subscribes to the manager's state stream, builds a `RemoteComposeWriter`, encodes, and serves the bytes to RC player clients on its own WebSocket.

See `references/bridge-design.md` for the proposed component layout.

## The open question: Native artifacts?

arch.md §10 leaves one thing unresolved: *does the bridge author from `androidx.compose.remote:remote-core` directly (Kotlin) or via a TS port?* Answer depends on whether the AndroidX `compose-remote` libraries publish Kotlin/Native artifacts so a single static binary can run on the bootc Pi.

**Current evidence (May 2026):** No. The `creation` libraries are explicitly split into `remote-creation-android` (AAR), `remote-creation-jvm` (plain JVM jar), and `remote-creation-compose` (Android-only). `remote-core` is published as a Java jar. There is no `-linuxArm64`, `-linuxX64`, `-native`, or `-wasmJs` qualifier visible in the artifact list. A Kotlin/Wasm preview exists in the `armcha/remotecompose` demo, but the official AndroidX publishing target is JVM + Android only.

**Implication:** the bridge most likely runs as a **JVM service in a container** on the bootc host, using `remote-creation-jvm` + `remote-core`. A TS port is not a serious option until `remote-core` has an external implementation; the binary format is not standalone-specified. See `references/artifacts.md` for the verification path (gmaven query, Gradle module metadata, cs.android.com).

## Why deferred

- v1 has no remote operators. The owner sits at the manager pi's terminal.
- The bus widget (TUI of worker rows, status, alerts) is sufficient.
- A streaming binary UI format buys nothing without a remote screen.
- Adding it now would require a player-surface decision and an alpha upstream.

When v2 adds a remote display, the bridge slots in behind the manager's existing JSON WebSocket without manager changes.

## Reference index

- `references/concept.md` — what RC is, how `.rc` works, comparison to Lottie/Skottie/server-driven UI.
- `references/artifacts.md` — Maven coordinates, target platforms, how to confirm Native publishing status.
- `references/bridge-design.md` — proposed `pi-rc-server` component layout and Quadlet sketch.
