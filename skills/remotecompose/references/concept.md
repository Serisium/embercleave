# RemoteCompose: concept and `.rc` format

## What it is

RemoteCompose is an AndroidX framework that lets one process (the **writer**) build a Compose UI and serialize it into a self-contained binary document — a `.rc` file — that another process (the **player**) renders natively. The framework lives at `androidx.compose.remote` and is in alpha (`1.0.0-alpha010` as of May 2026).

The framing in the AndroidX team's own pitch (Stoyko Donchev, "Introducing RemoteCompose: break your UI out of the app sandbox") is "more than a display list, less than an application." Unlike JSON-based server-driven UI (Airbnb's Lona, Lyft's Server Driven UI patterns, etc.) it does not transmit a *description* of widgets — it transmits the *operations* a Compose canvas would execute, with enough structural metadata to support layout, hit-testing, and click handlers on the player side.

Sources:
- AndroidX release page: https://developer.android.com/jetpack/androidx/releases/compose-remote
- API reference (creation): https://developer.android.com/reference/kotlin/androidx/compose/remote/creation/package-summary
- Speaker Deck (Stoyko Donchev): https://speakerdeck.com/camaelon/introducing-remotecompose-break-your-ui-out-of-the-app-sandbox
- Demo + web editor (armcha): https://github.com/armcha/remotecompose
- Kotlinlang Slack thread: https://slack-chats.kotlinlang.org/t/30153834/

## The writer side

A `RemoteComposeWriter` (from `remote-creation-jvm` for plain JVM, or `remote-creation-compose` for Compose-style authoring on Android) intercepts drawing operations at the Canvas level and serializes them. Typical flow (paraphrased from chatikyan's writeup, https://medium.com/@chatikyan/remote-compose-back-to-the-future-454b8e824fad):

```kotlin
val writer = RemoteComposeWriter(width = 200, height = 300)
writer.content {
  RemoteColumn {
    RemoteText("Hello", fontSize = 18f)
    RemoteButton(onClick = { /* action id */ }) {
      RemoteText("Click")
    }
  }
}
val bytes: ByteArray = writer.encodeToByteArray()
```

`bytes` is the entire UI ready for transmission. It is small enough (the framework was demoed running over Bluetooth to ESP32 microcontrollers, via NFC tags, and embedded in QR codes) that compactness is a defining design constraint, not an afterthought.

## The player side

A player consumes the byte array and renders it. The current alpha ships several:

- **`remote-player-view`** — Android View. The canonical surface; apps call `setDocument()` on a `RemoteComposePlayer` view.
- **`remote-player-core`** — shared rendering core consumed by the surface-specific players.
- **Glance / RemoteViews** — for Android home-screen widgets, where the OS process draws the UI from a wire format anyway. RemoteCompose fits this surface naturally.
- **Compose Desktop player** — marked WIP in Donchev's deck.
- **Compose for Web (Kotlin/Wasm)** — used by armcha's editor for live preview, not an officially published artifact.

Click handlers are encoded as **action IDs**, not closures. The player surfaces "the user tapped action N" back to the host, which decides what to do. This is what makes the document portable across processes and machines.

## What it is not

- **Not Lottie / Skottie.** Those are vector-animation playback formats with a tightly defined drawing-only schema. RemoteCompose includes layout, scrolling, and interactivity.
- **Not Flutter / a JS framework.** No runtime is shipped to the player; the player is native Compose code that interprets opcodes.
- **Not a replacement for a normal app.** The writer can express a meaningful subset of Compose, but as of alpha not every Compose primitive has a `Remote*` equivalent.
- **Not schema-versioned in the JSON sense.** The wire format is binary opcodes; player and writer must agree on a compatible alpha version.

## Why the format is interesting for embercleave

A bridge service would generate `.rc` documents from manager state and stream them to an RC player on a remote device. This decouples the manager (which knows about workers, statuses, and pi-swarm semantics) from the rendering surface (which can be any device that runs an RC player). The manager extension never has to learn about pixels.

But — see `artifacts.md` — the current AndroidX publishing footprint pushes the bridge toward a JVM container on the bootc host rather than a static native binary. That is a constraint to live with, not a blocker.
