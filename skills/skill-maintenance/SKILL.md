---
name: skill-maintenance
description: Workflow for keeping embercleave skills aligned with official docs. **Auto-load whenever WebFetch or WebSearch is used on a project library** — vitest, @biomejs/biome, typebox, @mariozechner/pi-coding-agent, TypeScript handbook (NodeNext, project-references, tsconfig), podman, Quadlet, fedora-bootc, systemd, journald, RemoteCompose, MCP gateway — to fill a gap in a SKILL.md or reference file; when adding a new skill under `skills/`; when patching a reference with newly-fetched docs; when a SKILL.md claim looks unverified, paraphrased, or version-stale. Captures the verify→quote→cite→sync workflow: fetch authoritative docs, quote load-bearing claims verbatim, add inline parenthetical URL citations matching the `typebox` style, and update `AGENTS.md` (trigger index + layered-model table) for any new skill. Triggers: skill maintenance, library docs research, citation sync, skill drift, AGENTS.md sync, progressive disclosure, level-3 references.
---

# Skill maintenance for embercleave

## What this skill is

A documented routine for the meta-task of authoring and maintaining the `skills/` tree itself. It exists because the SKILL.md / reference files in this repo make load-bearing factual claims (rule names, API signatures, version-specific behaviour) that go stale as upstream libraries evolve. Without a discipline for re-grounding, the skills drift from reality and start mis-leading future agents.

This skill encodes the workflow we ran when patching `vitest`, `biome`, and `tsc-project-refs` — verify each load-bearing claim against the official docs, quote verbatim where the claim is exact, add inline URL citations (matching the `typebox` skill's parenthetical style), and sync `AGENTS.md`.

## When to invoke this skill

**Always** when one of these conditions fires:

1. You are about to call `WebFetch` or `WebSearch` against any library this repo uses — vitest, biome, typebox, pi-coding-agent, the TypeScript handbook, podman, Quadlet, fedora-bootc, systemd/journald, etc.
2. You are about to edit a `skills/*/SKILL.md` or `skills/*/references/*.md` file with content sourced from external docs.
3. You are about to add a new skill directory under `skills/`.
4. You notice a SKILL.md claim that looks unverified ("from memory", paraphrased, no URL) and you suspect it might be wrong.

In all of these, read this SKILL.md first (you are doing that now), then proceed.

## The four-step workflow

### Step 1 — Identify the load-bearing claims

A *load-bearing claim* is a sentence the reader will rely on to make a decision. For library skills these are typically:

- Rule / option / API names (e.g. `noNonNullAssertion`, `vi.advanceTimersByTimeAsync`, `composite: true`).
- "Is X in the recommended set?" / "Does Y default to Z?" — boolean facts about library configuration.
- Version-specific behaviour (e.g. "Biome 1.9.x uses top-level `organizeImports`; 2.x moved it under `assist.actions.source.organizeImports`").
- Verbatim error-message strings the agent will grep for.

Non-load-bearing prose ("Biome is a Rust binary") does not need a citation.

### Step 2 — Fetch authoritative docs

Per-library starting points for `WebFetch`:

| Library                | Anchor URL                                                  |
|------------------------|-------------------------------------------------------------|
| vitest                 | `https://vitest.dev/api/vi.html`, `https://vitest.dev/guide/cli.html`, `https://vitest.dev/guide/mocking.html` |
| @biomejs/biome (1.9.x) | `https://biomejs.dev/linter/rules/<rule-name>/`, `https://biomejs.dev/reference/configuration-v1/` |
| typebox / @sinclair/typebox | `https://github.com/sinclairzx81/typebox`, `https://www.npmjs.com/package/@sinclair/typebox` |
| pi-coding-agent        | `https://github.com/badlogic/pi-mono` (TS sources are authoritative; published docs are sparse) |
| TypeScript NodeNext    | `https://www.typescriptlang.org/docs/handbook/modules/reference.html` |
| TypeScript project refs | `https://www.typescriptlang.org/docs/handbook/project-references.html` |
| TypeScript tsconfig    | `https://www.typescriptlang.org/tsconfig#<flag-name>`        |
| podman                 | `https://docs.podman.io/`                                   |
| Quadlet                | `https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html` |
| fedora-bootc           | `https://docs.fedoraproject.org/en-US/bootc/`               |
| systemd / journald     | `https://www.freedesktop.org/software/systemd/man/`         |

When the public docs are thin (vitest's mocking page does not document `vi.fn`'s generic), drop down to the **version-pinned source** on GitHub: `https://github.com/<org>/<repo>/blob/v<version>/<path>`. Pin to the version this repo uses.

Phrase the WebFetch prompt as a request for **quoted text and signatures**, not a paraphrase: "Quote the exact function signature of X" / "Quote the documented severity and group of rule Y". Paraphrased fetches reintroduce the same drift you are trying to remove.

See `references/research-and-cite.md` for prompt templates and citation patterns.

### Step 3 — Patch the skill

For each verified claim:

- If the existing SKILL.md text is correct, **add an inline citation** in the typebox style: parenthetical URL at the point of the claim, e.g. `(https://biomejs.dev/linter/rules/no-non-null-assertion/)`.
- If the existing text is wrong, rewrite it and add the citation.
- For exact strings (rule names, default severities, API signatures), **quote verbatim** with `> blockquote` syntax and cite the URL on the same line.

Citation convention (matches `typebox` SKILL.md): inline parenthetical URLs at first mention of each library and at the point of each load-bearing claim. **Never** add a "## Sources" footer — the citations live next to the claims they support.

Do not invent URLs. If WebFetch failed, say so in the body ("URL X returned 404 at time of writing; consult the v1 changelog directly") rather than fabricating a link.

### Step 4 — Sync `AGENTS.md`

For *any* change that adds, removes, or renames a skill:

- Update the layered-model table near the top.
- Add or update the trigger-index row (load conditions, references list).
- Keep the row's "Load when:" prose specific — name the files / commands / error messages that should fire it.

For changes that only modify content inside an existing skill, `AGENTS.md` does not usually need to change. The exception is when the skill picks up a new reference file — add it to the references list at the bottom of the trigger-index entry.

See `references/authoring-conventions.md` for the full repo-specific authoring checklist (Anthropic level-1/2/3 model, frontmatter rules, file-size targets, AGENTS.md sync checklist).

## What "auto-load" means here

A skill is "loaded" by the matcher when its `description` frontmatter overlaps the conversation's topic. To make this skill fire on any library-docs search, the description above lists every library name in the project plus the verbs that signal a search workflow. If you add a new library to the project, **edit this skill's description to add its name and anchor URLs to the table above** — that keeps the matcher hot for the new library.

## Common pitfalls

- **Paraphrasing instead of quoting.** "The rule is part of recommended" ≠ `> "Yes, it is enabled by default as a recommended rule."`. The verbatim quote is what survives a future doc reorganisation; the paraphrase rots.
- **Citing the homepage instead of the rule page.** `https://biomejs.dev` proves nothing about a specific rule's severity. Cite the rule page itself.
- **Forgetting version pinning.** Biome 2.x and 1.9.x have different config schemas; vitest 2.x and 3.x have different mock APIs. Cite the docs for the **version pinned in `package.json`**, not the latest.
- **Skipping `AGENTS.md` sync.** A new skill with no row in the trigger index will never auto-load.
- **Writing a `## Sources` footer.** This repo cites inline. Footers create two places to keep in sync.

## When to load reference files

- Choosing what to fetch and how to phrase the prompt: `references/research-and-cite.md`.
- Authoring a brand-new skill from scratch (Anthropic's level-1/2/3 model + this repo's conventions + AGENTS.md checklist): `references/authoring-conventions.md`.
