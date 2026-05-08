# Diagnosing NodeNext resolution failures

NodeNext is the Node-aligned ESM resolver (https://www.typescriptlang.org/docs/handbook/modules/reference.html). It is stricter than the older `node` mode, so symptoms unique to it appear when porting code from older TS configs or copy-pasting from snippets that assume bundler-style resolution. Walk this checklist.

## 1. Did the import end in `.js`?

Symptom: `error TS2307: Cannot find module './foo' or its corresponding type declarations.` even though `./foo.ts` plainly exists.

Cause: NodeNext requires the runtime extension. TypeScript will not synthesise it for you.

Fix:

```ts
// before
import { x } from "./foo";
// after
import { x } from "./foo.js";
```

This applies to relative imports only. Bare-package and `node:`-prefixed imports do not take an extension.

## 2. Is it a directory import?

Symptom: `Cannot find module './use-cases'` where `use-cases/` is a directory containing `index.ts`.

Cause: directory imports are **not supported in `import` statements** under `nodenext`/`node16` (https://www.typescriptlang.org/docs/handbook/modules/reference.html). The asymmetry is real: the same path is fine via `require()` in CommonJS, but ESM `import` resolution does not synthesise `/index.js`. TypeScript mirrors Node's runtime here.

Fix: import the file by its full path:

```ts
import { connectToBus } from "./use-cases/connect-to-bus.use-case.js";
```

The codebase already enforces "no internal barrel files" (`AGENTS.md`); this rule is part of the same constraint.

## 3. Did you forget to add a `references[]` entry?

Symptom: `Cannot find module '@serisium/embercleave-protocol'` from a package that obviously depends on it; the file resolves at runtime.

Cause: `tsc -b` builds projects in dependency order from each project's `references[]`. If you added the dep to `package.json` but not to the project's `tsconfig.json`, the build does not see the dependency's `.d.ts`.

Fix:

```json
"references": [{ "path": "../protocol" }]
```

## 4. Is the dependency a sibling package?

Symptom: imports from `@serisium/embercleave-foo` work in editor but fail at build with "Cannot find module".

Cause: `dependencies` lists the package without `workspace:*`, so pnpm fetched a published version that lags or doesn't exist.

Fix: change the version range to `"workspace:*"` and re-run `pnpm install`.

## 5. Are types and imports out of sync?

Symptom: a value import works, but `import type` from the same path fails.

Cause: usually a stale `dist/.tsbuildinfo` — the dependency's `.d.ts` is from a previous build that did not re-emit the type.

Fix: `pnpm --filter @serisium/embercleave-<dep> exec tsc -b --force` then rebuild the dependent.

## 6. Is the file outside `rootDir`?

Symptom: `error TS6059: File '...' is not under 'rootDir' '.../src'`.

Cause: a relative import escapes `src/`. NodeNext does not care, but `composite` does — every input must live under `rootDir`.

Fix: do not import from outside `src/`. Test files live in `test/` and run through Vitest, not `tsc -b`. If you genuinely need to share something across `src/` and a sibling location, move it into `src/` first.

## 7. Reading the error twice

NodeNext errors often print the resolver's attempted lookups. Read the *whole* message — TypeScript will tell you `did you mean './foo.js'?` if it can guess. The codebase has not seen a single case where the answer was anything other than one of the seven items above.
