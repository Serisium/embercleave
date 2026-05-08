---
name: biome
description: Reference for Biome (`@biomejs/biome`), the single linter+formatter+import-organiser used across the embercleave workspace. Use when running `pnpm lint` / `pnpm fix` / `pnpm format`, debugging a CI lint failure, deciding whether a file legitimately needs a `default export` (warning), adding a non-null assertion in production vs. test code, reading or editing `biome.json`, choosing where a new override block belongs (e.g. `framework/extension-entry.ts` is the only `default export` exception), or explaining why a file's formatting changed after a checkout. Triggers: biome, `@biomejs/biome`, `biome check`, `biome.json`, `noDefaultExport`, `noNonNullAssertion`, `organizeImports`, lint failure, formatter conflict, `pnpm lint`, `pnpm fix`.
---

# Biome in embercleave

## What Biome is

Biome (https://biomejs.dev, https://www.npmjs.com/package/@biomejs/biome) is a single Rust binary that does linting, formatting, and import sorting, replacing ESLint + Prettier + organize-imports plugins. embercleave pins `@biomejs/biome@^1.9.4` at the workspace root; configuration lives in `biome.json` at the repo root and applies to every package — there are no per-package overrides except those expressed in the root config.

Biome 2.x reorganised the config schema (notably moving import organisation under `assist.actions.source.organizeImports`). embercleave's `biome.json` declares `"$schema": "https://biomejs.dev/schemas/1.9.4/schema.json"` and uses the **1.x layout** throughout — top-level `organizeImports`, top-level `linter.rules`, etc. Do not paste in 2.x snippets without translating.

## Commands

From the workspace root (any other cwd works because Biome resolves config upward):

- `pnpm lint` → `biome check .` — lint + format diagnostics, non-zero exit on findings.
- `pnpm fix` → `biome check --write .` — apply autofixes for both lint and format.
- `pnpm format` → `biome format --write .` — formatter only, no lint changes.

There is no `--watch` mode wired into package.json; run the editor integration (Biome's official VS Code/JetBrains plugins) for that.

## What's enabled

`biome.json` enables the recommended rule set plus one explicit style rule, and turns the import organiser on:

```json
{
  "linter": { "enabled": true, "rules": { "recommended": true, "style": { "noDefaultExport": "warn" } } },
  "organizeImports": { "enabled": true }
}
```

`noDefaultExport` is **not in the recommended preset** (https://biomejs.dev/linter/rules/no-default-export/) — it has to be enabled explicitly, which is what `biome.json` does. It implements the "one exported symbol per file, named export only" rule from `AGENTS.md`. The default severity from Biome is `warn`; the codebase keeps it as `warn` because exactly one file legitimately needs a default export — see overrides below.

`noNonNullAssertion`, by contrast, **is in the recommended preset** (https://biomejs.dev/linter/rules/no-non-null-assertion/) at severity `warn`. That is why the test-file override is necessary: without it every `array[0]!` in the test suite produces a diagnostic.

## Formatter conventions

| Setting           | Value     | Why                                          |
|-------------------|-----------|----------------------------------------------|
| `indentStyle`     | `space`   | Matches TS ecosystem default                 |
| `indentWidth`     | `2`       | Standard                                     |
| `lineWidth`       | `100`     | Wider than Prettier's 80; chosen for readable port/use-case signatures |
| `quoteStyle`      | `double`  | Apply to JS/TS — JSON config files keep their own rules |
| `semicolons`      | `always`  | Explicit; avoids ASI hazards                 |
| `trailingCommas`  | `all`     | Cleaner diffs on argument-list growth        |
| `arrowParentheses`| `always`  | Consistent with `() => x`, `(a) => x`        |

JSON files override `trailingCommas` to `none` because most JSON consumers reject them.

## Per-path overrides

Two narrow overrides in `biome.json`:

```json
"overrides": [
  { "include": ["**/framework/extension-entry.ts"],
    "linter": { "rules": { "style": { "noDefaultExport": "off" } } } },
  { "include": ["**/test/**/*.ts", "**/*.test.ts"],
    "linter": { "rules": { "style": { "noNonNullAssertion": "off" } } } }
]
```

### Why each override exists

- **`framework/extension-entry.ts` may use `export default`.** Pi extensions are loaded via dynamic import and consume the default export as the extension factory. This is the only file in the workspace that may; do not generalise the override to broader paths.
- **Test files may use non-null assertions.** Tests routinely write `bus.lines[0]!` after asserting the array has the expected shape. Production code (`src/`) must not — use a real null check or a precondition.

If you find a third class of file fighting a recommended rule, prefer fixing the file over adding a third override. The override list is a deliberate constraint.

## Workflow at edit time

1. Edit a file.
2. Run `pnpm fix` (or save with the editor plugin) — autofixes formatting, sorts imports.
3. Run `pnpm lint` — confirms no remaining lint findings.
4. If a finding is intentional (e.g. justified `default export` outside `framework/extension-entry.ts`), fix the design rather than disabling the rule. Inline `// biome-ignore` directives are not used in this codebase as of v1; introducing them needs a reviewer's explicit OK.

## Common pitfalls

- **Biome reorders imports.** Adding an import in the "wrong" group causes a diff on next `pnpm fix`. Either run `pnpm fix` before committing or rely on the editor plugin to keep imports sorted as you type.
- **Biome and TS-only conventions.** Biome does not check TypeScript-specific concerns like unused `import type` — `tsc` does, via `noUnusedLocals` in `tsconfig.base.json`. Running `pnpm -r build` is the cheap way to surface those.
- **JSON files with comments.** Biome's JSON parser respects `*.jsonc` / `*.json5` only when extensions match. Standard `.json` will reject comments — relevant for `tsconfig.json` (which TypeScript permits comments in but Biome does not by default; the codebase keeps `tsconfig*.json` comment-free).

## When to load reference files

- Adding a new override block, or interpreting an existing one: `references/rules-and-overrides.md`.
