---
name: tsc-project-refs
description: Reference for the embercleave TypeScript build — composite project references, `tsc -b`, NodeNext ESM resolution, and the `.js` import-extension requirement that catches every newcomer. Use when adding a new package to the workspace, wiring a new cross-package dependency in `references[]`, debugging a `Cannot find module './foo'` that would resolve fine without NodeNext, choosing between `import type` and a value import, editing `tsconfig.base.json` or a per-package `tsconfig.json`, untangling a stale `dist/.tsbuildinfo`, or explaining why every relative import ends in `.js` even though source files end in `.ts`. Triggers: `tsc -b`, `tsc --build`, composite project, `references`, `rootDir`, `outDir`, `tsBuildInfoFile`, NodeNext, `moduleResolution: NodeNext`, `.js` extension on imports, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `Cannot find module`, ESM-only.
---

# TypeScript build in embercleave

Authoritative TypeScript references for this skill: the modules-reference handbook page (https://www.typescriptlang.org/docs/handbook/modules/reference.html), the project-references handbook page (https://www.typescriptlang.org/docs/handbook/project-references.html), and the per-flag tsconfig reference (https://www.typescriptlang.org/tsconfig). Where this skill quotes a rule it cites the URL inline.

## Layout

The workspace is one TypeScript "solution" composed of four package-level projects:

```
embercleave/
├── tsconfig.base.json        # shared compilerOptions
├── tsconfig.json             # solution: { files: [], references: [...] }
└── packages/
    ├── protocol/tsconfig.json
    ├── worker/tsconfig.json
    ├── manager/tsconfig.json
    └── quadlet/tsconfig.json
```

`tsc -b` (or `pnpm -r build`) builds them in topological order, skipping unchanged inputs via per-project `dist/.tsbuildinfo` caches.

## `tsconfig.base.json` — what's set and why

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "skipLibCheck": true,

    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

The non-obvious choices:

- **`module: NodeNext` + `moduleResolution: NodeNext`** — the project ships ESM (`"type": "module"` in every `package.json`). NodeNext mirrors Node's runtime ESM resolver; emitted JS imports work without a bundler.
- **`composite: true` + `declaration: true`** — required for project references. The handbook (https://www.typescriptlang.org/docs/handbook/project-references.html) is explicit: *"Referenced projects must have the new `composite` setting enabled. This setting is needed to ensure TypeScript can quickly determine where to find the outputs of the referenced project,"* and *"Importing modules from a referenced project will instead load its output declaration file (`.d.ts`)."* `declarationMap` is not required for project refs but makes editor "Go to Definition" jump into source instead of `.d.ts`.
- **`noUncheckedIndexedAccess`** — every array/object index returns `T | undefined`. Tests use `arr[0]!` (allowed by the Biome test override); production code must check.
- **`exactOptionalPropertyTypes`** — `{ x?: string }` does *not* permit `{ x: undefined }`. Use either omit-the-key or change the type to `x?: string | undefined` deliberately.
- **`noUnusedLocals` / `noUnusedParameters`** — caught by `tsc`, not Biome. Run `pnpm -r build` to surface these; the lint pass alone will not.
- **`skipLibCheck: true`** — pi's published types and Typebox's both have edges Biome+`tsc` don't need to police; we trust them.

## Per-package `tsconfig.json`

Every package extends the base and sets its own paths and references:

```jsonc
// packages/worker/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../protocol" }]
}
```

Key invariants:

- `rootDir: "src"` — `tsc` rejects files outside `src/` (so test files compile through Vitest's transformer, not `tsc`).
- `outDir: "dist"` — matches `package.json#exports` (`./dist/index.js`).
- `references[].path` mirrors the runtime `dependencies` graph: any package imported via `@serisium/embercleave-*` must be listed.

When you add a dependency on another workspace package:

1. Add it to `dependencies` with `"workspace:*"`.
2. Add `{ "path": "../<other>" }` to `references` in this package's `tsconfig.json`.
3. Run `pnpm install` then `pnpm -r build`.

Forgetting step 2 produces a successful single-package build but a broken `tsc -b` from the root.

## The `.js` extension on relative imports

Under `moduleResolution: NodeNext`, **`import` statements** for relative paths must include the runtime extension; **extensionless relative paths are not supported in `import`** (https://www.typescriptlang.org/docs/handbook/modules/reference.html). Directory imports (e.g. `./use-cases` resolving to `./use-cases/index.js`) are likewise **not supported in `import`** under `nodenext`/`node16` — the same handbook page contrasts this with `require()`, which retains both. embercleave is ESM-only, so the strict `import` rules apply everywhere.

Because TypeScript does not rewrite paths, the source must already write `.js`:

```ts
// CORRECT — even though the source file is reconnect-schedule.ts
import { reconnectDelayMs } from "../domain/reconnect-schedule.js";

// WRONG — works in older `moduleResolution: node` setups, fails under NodeNext
import { reconnectDelayMs } from "../domain/reconnect-schedule";
```

Why the source uses `.js` rather than `.ts`:

- The emitted file is `.js`. Imports must match the emitted layout, not the source layout.
- Vitest, Vite, and most modern bundlers understand the `.js`-points-at-`.ts` convention via TypeScript's own resolver.
- Switching to `.ts` would break every published `dist/` consumer.

This rule applies to every relative import in `src/` and in `test/`. Bare-package imports (`@serisium/embercleave-protocol`) and Node built-ins (`node:net`) do *not* take an extension.

## `import type` vs. value imports

Under NodeNext + ESM, `import type` is erased entirely from emit. Use it for:

- Port interfaces (`import type { BusClientPort } from "..."`).
- Schema-derived TS types (`import type { BusMessage } from "@serisium/embercleave-protocol"`).
- Any name only referenced in type position.

Mixing them is fine: `import { type Static, Type } from "typebox"`. The `type` keyword on individual specifiers gets erased; the unmarked ones become real imports.

Wrong choice symptom: a circular runtime import that disappears when you change `import` to `import type`. That is the resolver telling you the symbol is type-only — apply the keyword.

## `tsc -b` lifecycle

The handbook (https://www.typescriptlang.org/docs/handbook/project-references.html) describes `tsc --build` (`tsc -b` for short) as: *"Find all referenced projects, detect if they are up-to-date, build out-of-date projects in the correct order."* It also notes *"`tsc -b` effectively acts as if `noEmitOnError` is enabled for all projects."*

- **Build everything from a clean tree:** `pnpm -r build` (runs `tsc -b` in topological order via pnpm filtering) or `tsc -b` from the workspace root.
- **Force a rebuild of one package:** `pnpm --filter @serisium/embercleave-worker exec tsc -b --force`.
- **Clean every package:** `pnpm clean` (root) → invokes `tsc -b --clean` per package.
- **`dist/.tsbuildinfo` is incremental state.** It pairs with `composite` / `incremental` to record which inputs were last seen (https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile). Delete it only when you suspect cache corruption — usually the symptom is "I changed a `.d.ts` and downstream did not rebuild," and the right fix is `--force`, not deleting state files by hand.

## When to load reference files

- Adding a brand-new package with new cross-references: `references/adding-a-package.md`.
- Diagnosing a NodeNext resolution failure: `references/nodenext-resolution.md`.
