# Biome rules and overrides — what's on, what's narrowed, why

## The recommended set

`"recommended": true` in `biome.json` opts into Biome's curated default lint set (https://biomejs.dev/linter/rules/). It covers correctness, suspicious patterns, accessibility (irrelevant for this server-side codebase but cheap to leave on), and style. `noNonNullAssertion` is in this set at severity `warn` (https://biomejs.dev/linter/rules/no-non-null-assertion/), which is the reason the test-files override below is required: without it, every `array[0]!` in the test suite would produce a diagnostic.

The recommended set evolves with Biome releases. A version bump can add diagnostics on previously clean code. When that happens:

1. Re-pin Biome in `package.json` and run `pnpm fix`.
2. If the new diagnostic is genuinely reporting a bug, accept the fix.
3. If it's noisy in this codebase's idioms, narrow it via an override (with a comment in `biome.json` justifying the scope) — do not turn it off globally.

## The single project-wide style addition

```json
"style": { "noDefaultExport": "warn" }
```

`noDefaultExport` is **not in Biome's recommended set** (https://biomejs.dev/linter/rules/no-default-export/) — it must be enabled explicitly, which is what this line does. It enforces the `AGENTS.md` "no default exports inside packages" convention. `warn` was chosen so a missing `framework/extension-entry.ts` override does not break CI on day-zero of the package; once the override list is correct, treat any warning as an error during code review.

If you ever consider promoting it to `"error"`, do so only after auditing for false positives in test fixtures and config files.

## Override 1: `framework/extension-entry.ts`

```json
{ "include": ["**/framework/extension-entry.ts"],
  "linter": { "rules": { "style": { "noDefaultExport": "off" } } } }
```

### Scope

Exactly one filename, in any package, anywhere in the path. The glob is intentionally permissive on parent directory so the rule survives package reorganisation as long as the convention `framework/extension-entry.ts` holds.

### Why

`@mariozechner/pi-coding-agent` loads extensions via dynamic `import(specifier)` and reads `module.default` as the factory. There is no documented named-export entry point in pi v0.73.x. If pi adds one, drop this override.

### What it does *not* permit

It does not permit `default export` from `src/index.ts` or any other file. `src/index.ts` is a barrel of named re-exports per the file-naming rules (`AGENTS.md`). Keep it that way.

## Override 2: test files

```json
{ "include": ["**/test/**/*.ts", "**/*.test.ts"],
  "linter": { "rules": { "style": { "noNonNullAssertion": "off" } } } }
```

### Scope

Both `packages/<pkg>/test/**` (the canonical location) and any `*.test.ts` anywhere — the second pattern is a safety net for ad-hoc test files that escape the `test/` tree.

### Why

Tests routinely capture wire frames into arrays and assert on `array[0]!`. The non-null assertion is shorter than `array[0] ?? throw new Error(...)` or `if (!array[0]) throw` and the test will fail loudly anyway if the assumption breaks.

### Reach for the assertion sparingly

Production code (`src/**`) must use a genuine null check or a domain-level invariant. The override is for tests, not for "tests of production code that we're treating like tests". If a `src/` file is fighting `noNonNullAssertion`, the fix is to redesign the data flow so the value is genuinely non-null at that point — usually by lifting the check earlier.

## Adding a new override

1. Demonstrate the rule is genuinely wrong for the pattern, not just inconvenient. The bar is "the rule contradicts a documented convention".
2. Use the narrowest `include` pattern that covers the case. Prefer file-level globs over directory-level.
3. Add a one-line comment in `biome.json` (Biome's JSON parser tolerates them in the schema-validated config file).
4. Update this reference with the rationale.

The override list is small on purpose — every entry is a deliberate carve-out from the recommended set, and reviewers should treat additions with the same care as schema changes.
