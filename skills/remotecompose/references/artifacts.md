# `androidx.compose.remote` artifacts and target platforms

## Coordinates (group `androidx.compose.remote`)

As of `1.0.0-alpha010` (released 2026-05-06; AndroidX release page https://developer.android.com/jetpack/androidx/releases/compose-remote):

| Artifact | Purpose | Packaging |
|---|---|---|
| `remote-core` | Shared core for parsing/playing `.rc` documents | jar |
| `remote-creation` | Procedural creation API (umbrella) | jar |
| `remote-creation-core` | Platform-agnostic creation core | jar |
| `remote-creation-android` | Android-specific creation extensions | aar |
| `remote-creation-jvm` | Plain-JVM creation (no Android SDK) | jar |
| `remote-creation-compose` | Compose-DSL authoring surface | aar (Android-only) |
| `remote-player-core` | Shared player core | jar |
| `remote-player-view` | Android `View` player | aar |
| `remote-tooling-preview` | Studio preview tooling | aar |

mvnrepository index: https://mvnrepository.com/artifact/androidx.compose.remote

Per-artifact pages:
- https://mvnrepository.com/artifact/androidx.compose.remote/remote-core
- https://mvnrepository.com/artifact/androidx.compose.remote/remote-creation-jvm
- https://mvnrepository.com/artifact/androidx.compose.remote/remote-creation-android
- https://mvnrepository.com/artifact/androidx.compose.remote/remote-creation-core

## The Native question (arch.md §10 open question)

**Question:** does the bridge author from `remote-core` directly (Kotlin) or via a TS port? Resolves on whether AndroidX publishes Kotlin/Native artifacts.

**Current finding (May 2026):** No Kotlin/Native artifacts are published. Evidence:

1. The artifact split itself — `remote-creation-android` (aar), `remote-creation-jvm` (jar), `remote-creation-compose` (Android-only) — is the classic Android+JVM split, not the KMP `-jvm` / `-linuxArm64` / `-iosArm64` / `-wasmJs` qualifier pattern. KMP libraries publish a per-target artifact per Kotlin target; we see only the two.
2. The AndroidX release page targets "Java 11" bytecode for `remote-core` from alpha06 onward — language for a JVM artifact, not a klib.
3. The `armcha/remotecompose` demo uses Kotlin/Wasm only on the *editor* side via Compose Multiplatform's existing canvas pipeline; the actual `RemoteComposeWriter` runs on JVM.
4. No KMP source set hints (commonMain, nativeMain, wasmJsMain) appear in the public AndroidX source path under `compose/remote/` on https://cs.android.com/androidx/platform/frameworks/support/+/androidx-main:compose/.

## How to re-verify (when work starts)

1. **Google Maven directly:** browse https://maven.google.com/web/index.html?q=compose.remote and look for any artifact whose `artifactId` ends in `-jvm`, `-linuxx64`, `-linuxarm64`, `-macosarm64`, `-iosarm64`, `-wasmjs`, or `-native`. Also look for a `module` Gradle Module Metadata file alongside the pom for any artifact — its `variants` array enumerates published targets.
2. **Direct GMaven URL pattern:** `https://maven.google.com/androidx/compose/remote/remote-core/<version>/` lists files. A KMP publication would include `*-all.jar`, `*.module`, and per-target jars/klibs.
3. **AndroidX source:** https://cs.android.com/androidx/platform/frameworks/support/+/androidx-main:compose/remote/ — read the per-module `build.gradle` for `androidXMultiplatform { jvm(); linuxX64(); ... }` blocks vs an Android-only `androidx.android` plugin.
4. **Issue tracker:** https://issuetracker.google.com — search "compose remote native" for tracked feature requests.

## Implication for the bridge

Until Native publishing happens, the bridge should be a **JVM service in a container**. Practically: GraalVM native-image is one option to ship a static binary, but the `remote-creation-jvm` library uses standard JVM bytecode and reflection-light enough that running a regular JDK in the container is the simplest path. The container runs as `pi-rc-server.container` Quadlet on the bootc host (see `bridge-design.md`).

A TS port is **not** a serious option until the `.rc` binary format has an external specification. As of alpha the only specification is the `remote-core` source itself, so a TS reimplementation would be a perpetual catch-up project against an upstream that explicitly warns its APIs will change.

## Target snapshot (for future verification)

When the work begins, fill in the actual artifact list:

```
$ curl -s https://maven.google.com/androidx/compose/remote/group-index.xml
$ curl -s https://maven.google.com/androidx/compose/remote/remote-core/<v>/remote-core-<v>.module | jq .variants
```

If `variants` shows entries with `org.jetbrains.kotlin.platform.type = native` or `wasm`, the answer has flipped and a Kotlin/Native bridge becomes viable.
