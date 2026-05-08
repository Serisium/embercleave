# Research and citation conventions

Detailed workflow for verifying a load-bearing claim against official documentation and writing the citation back into a SKILL.md or `references/<topic>.md`.

## Prompt templates for `WebFetch`

The model behind `WebFetch` summarises by default. Force it to quote by writing the prompt as a request for verbatim text. Templates that work well:

### Library API surface

> "Quote the exact TypeScript signature of `<symbol>` as exported from `<package>`. Quote any version notes about when it was added, deprecated, or renamed. Do not paraphrase."

Example: when patching the `vitest` skill, we asked the spy package source on GitHub to "quote the exact `export function fn` declaration including its generics." That returned `export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>` — the verbatim signature that now lives in the SKILL.md.

### Linter rule metadata

> "What group does the rule `<rule-name>` belong to? Is it part of the recommended preset? What is its default severity? Quote the documentation verbatim."

This is the prompt we used for `noDefaultExport` and `noNonNullAssertion`. The verbatim answers ("Yes, it is enabled by default as a recommended rule" / "This rule isn't recommended, so you need to enable it") drove the SKILL.md correction about which rule is or is not in the recommended set.

### Spec-level behaviour

> "Under `<config>`, what does the spec say about `<behaviour>`? Quote exact text from the handbook."

Used for the NodeNext `.js`-extension and directory-import rules. The handbook's literal "extensionless relative paths are NOT supported in `import`" became an inline blockquote in the `tsc-project-refs` skill.

### CLI flags

> "Confirm whether `--<flag>` exists, what it does, and which version added it. Quote exact text."

The vitest CLI page returned the verbatim "Pass when no tests are found" for `--passWithNoTests`.

## When to drop down to source

Public docs are sometimes thin or out of date. When the doc page does not describe the feature you are documenting, fetch the **version-pinned source** on GitHub:

```
https://github.com/<org>/<repo>/blob/v<version>/<path-in-repo>
```

`v<version>` must match the repo's pinned version. For embercleave: `vitest@^2.1.8` → `https://github.com/vitest-dev/vitest/blob/v2.1.8/...`. The TypeScript signature for `vi.fn` came from this approach because `vitest.dev/guide/mocking.html` did not show the generic form.

Source-derived citations should still cite the GitHub URL inline. The pinned version in the URL is part of the citation — it freezes the claim against future edits.

## Citation style (the `typebox` convention)

The project's pre-existing `typebox` SKILL.md sets the convention:

> "Typebox (`@sinclair/typebox`, https://github.com/sinclairzx81/typebox, https://www.npmjs.com/package/@sinclair/typebox) builds JSON Schema documents and TS types from the same definition."

Two patterns to mirror:

### Pattern A — first-mention parenthetical

Use at the first mention of the library in the SKILL.md body:

```markdown
Vitest (https://vitest.dev, https://www.npmjs.com/package/vitest,
API reference at https://vitest.dev/api/vi.html) is a Vite-native test runner...
```

Multiple URLs in one parenthetical is fine when they are complementary (homepage + npm + key doc page).

### Pattern B — at-the-claim parenthetical

Use at the point of any load-bearing claim:

```markdown
`noNonNullAssertion`, by contrast, **is in the recommended preset**
(https://biomejs.dev/linter/rules/no-non-null-assertion/) at severity `warn`.
```

The URL is on the same sentence as the claim it backs. A reader who doubts the sentence can click the link and verify in seconds.

### Pattern C — verbatim blockquote with citation

For exact strings (severities, error messages, API signatures), quote verbatim and cite on the next line:

```markdown
The handbook (https://www.typescriptlang.org/docs/handbook/project-references.html)
is explicit:

> "Referenced projects must have the new `composite` setting enabled."
```

## What never to do

- **Do not write a `## Sources` footer.** This repo's convention is inline-only. Footers and inline citations together is two places to keep in sync.
- **Do not invent URLs.** If `WebFetch` failed or returned 404, write that in the body ("at time of writing, the v1.9.x reference page returned 404; consult the v1 changelog directly") instead of fabricating a link.
- **Do not cite the homepage as proof of a specific claim.** `https://biomejs.dev` does not prove anything about `noNonNullAssertion`; the rule page does. Pick the most-specific URL that supports the claim.
- **Do not paraphrase a quote and keep the citation.** Either quote verbatim (and keep the cite), or paraphrase and drop the cite — never paraphrase under the guise of a quote.

## Re-grounding cadence

Skills do not need re-grounding on a fixed schedule. Re-ground when:

- The library version in `package.json` changes (a Biome 1.9 → 2.0 bump invalidates the `organizeImports` placement).
- A reader points out that a SKILL.md claim contradicts what they observe.
- You are about to make a change that depends on the claim and want to be sure.

A re-grounding pass is the same workflow as initial authoring: fetch, quote, cite, sync `AGENTS.md` only if the public surface of the skill changed.
