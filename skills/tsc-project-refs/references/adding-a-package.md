# Adding a new workspace package

When the architecture grows a fifth (or sixth) `@serisium/embercleave-*` package — for example a future `embercleave-rc-server` bridge — wire it consistently with the existing four.

## 1. Directory and `package.json`

```
packages/<name>/
├── package.json
├── tsconfig.json
├── AGENTS.md          (per-package navigation; see top-level AGENTS.md)
├── src/
│   ├── index.ts
│   ├── domain/
│   ├── use-cases/
│   ├── adapters/
│   └── framework/
│       └── extension-entry.ts
└── test/
```

`package.json` template:

```json
{
  "name": "@serisium/embercleave-<name>",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20.18.1" },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "AGENTS.md", "README.md"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsc -b",
    "clean": "tsc -b --clean",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@serisium/embercleave-protocol": "workspace:*"
  }
}
```

## 2. `tsconfig.json`

```json
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

Add a `references[]` entry for every workspace package the new one imports — the runtime `dependencies` and the build-time `references[]` must agree.

## 3. Register the package with the solution

Edit the root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/protocol" },
    { "path": "./packages/worker" },
    { "path": "./packages/manager" },
    { "path": "./packages/quadlet" },
    { "path": "./packages/<name>" }
  ]
}
```

The order is conventional, not load-bearing — `tsc -b` resolves the build order from each project's `references[]`.

## 4. pnpm workspace discovery

`pnpm-workspace.yaml` already includes `packages/*`, so `pnpm install` will pick the new package up without changes. After install:

```sh
pnpm -r build   # confirms TS compiles cleanly
pnpm lint       # confirms Biome is happy
pnpm -r test    # confirms vitest finds the (possibly empty) test tree
```

## 5. AGENTS.md links

The per-package `AGENTS.md` is referenced from the top-level `AGENTS.md` "Per-package navigation" list. Add the new entry there. The package-level `AGENTS.md` should follow the existing four — short, links into `src/` and `test/` by intent, defers detail to skills.

## 6. Things that go wrong

- **Forgetting `composite: true`.** Inherited from the base; do not override it back to `false`. Project references require it.
- **Forgetting `references[]` in the new package's tsconfig.** Single-package builds succeed (the workspace symlink resolves at runtime), but `tsc -b` from the root fails because the dependency graph is wrong.
- **`dist/.tsbuildinfo` collision.** Each package writes its own; never share or commit them.
- **Adding a non-`workspace:*` dep on another internal package.** Always `"workspace:*"` for sibling packages — pnpm rewrites it on publish, but during development it must be a workspace symlink.
