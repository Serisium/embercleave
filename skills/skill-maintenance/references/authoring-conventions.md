# Authoring conventions for embercleave skills

The full checklist for creating a new skill or auditing an existing one. Combines Anthropic's official progressive-disclosure model with this repo's specific layout.

## Anthropic's three-level model

From the official Agent Skills overview (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview):

| Level | When loaded                  | Token budget                | Content                                       |
|-------|------------------------------|-----------------------------|-----------------------------------------------|
| 1     | Always (at startup)          | ~100 tokens / skill         | YAML frontmatter `name` + `description`       |
| 2     | When triggered               | Under 5k tokens             | SKILL.md body — instructions and decision tree |
| 3     | As needed                    | Effectively unlimited       | Reference markdown, code, schemas, examples   |

The doc's exact framing:

> "Progressive disclosure ensures only relevant content occupies the context window at any given time."

> "Skills can include comprehensive API documentation, large datasets, extensive examples, or any reference materials you need. There's no context penalty for bundled content that isn't used."

The repo's `skills/` tree mirrors this exactly — frontmatter, SKILL.md body, and `references/<topic>.md` files for level-3 depth.

## Frontmatter rules

From the same doc:

- `name`: ≤64 chars, lowercase letters / digits / hyphens only, no XML tags, must not contain reserved words `anthropic` or `claude`.
- `description`: non-empty, ≤1024 chars, no XML tags, must encode **both what the skill does and when to use it**.

This repo's additional convention: pack the `description` with library names and trigger phrases so the matcher fires reliably. The matcher only sees the frontmatter at startup; an under-keyworded description means the skill never loads.

Verify char count after editing:

```sh
awk 'NR==1{p=1;next} /^---$/&&p{p=0;exit} p{print}' skills/<name>/SKILL.md | wc -c
```

## SKILL.md body

Aim for ≤5k tokens (~5KB plain markdown is a fine proxy). Structure:

1. **What this skill is** — one short paragraph.
2. **Role in embercleave** — connect it to a layer in `arch.md` (cite by line number where load-bearing).
3. **The procedural body** — the actual decision tree.
4. **When to load reference files** — bullet list mapping decision branches to `references/<topic>.md`.

The body should *route* the agent to deeper references, not duplicate them. If a section grows past ~30 lines it probably belongs in a reference.

## Reference files

`skills/<name>/references/<topic>.md`. Each file is a single topic so the SKILL.md decision tree can route to it precisely. Length budget is loose — Anthropic notes "effectively unlimited" — but in practice 50–200 lines per reference is the sweet spot. Beyond that, split.

References should be loadable independent of each other. If `references/A.md` only makes sense after reading `references/B.md`, that is a sign B should be merged into the SKILL.md decision tree (since SKILL.md is always loaded when triggered) and A can stand alone.

Citations follow the `typebox` inline-parenthetical convention (see `research-and-cite.md`). No `## Sources` footers.

## File-naming rules (this repo)

From top-level `AGENTS.md`'s "File-naming rules" — most apply to source code, but a few apply to skills:

- One topic per reference file. File name mirrors the topic (`mocking.md`, not `details.md`).
- No internal barrel files. Each reference is reached directly via the SKILL.md routing list.

## AGENTS.md sync checklist

For a new skill, four edits in `AGENTS.md`:

1. **Layered model table** at the top — add the skill to the appropriate row (or create a new row if it represents a new layer of concerns, as `Build` was added for `tsc-project-refs` / `vitest` / `biome`).
2. **Trigger index entry** — a `### [`<name>`](skills/<name>/SKILL.md) — <one-line summary>` heading followed by a "Load when:" paragraph that names the *files, commands, and error messages* that should fire it. End with `References: <list>.`.
3. **Cross-cutting authority rules** — only if the skill introduces a permission boundary or authority claim that touches workers/manager/host (rare).
4. **Implementation conventions** — only if the skill changes how packages are structured (very rare).

For modifications to an existing skill that add a new reference file, add it to the references list at the end of that skill's trigger-index entry.

## Naming & placement examples in this repo

| Good                          | Why                                                          |
|-------------------------------|--------------------------------------------------------------|
| `skills/typebox/SKILL.md`     | Library name as skill name                                   |
| `skills/tsc-project-refs/`    | Concept name when no single library owns it                  |
| `references/discriminated-unions.md` | Topic name, not "details"                              |
| `references/nodenext-resolution.md`  | Specific failure mode the agent will look up           |

| Avoid                         | Why                                                          |
|-------------------------------|--------------------------------------------------------------|
| `skills/build/`               | Too generic; `tsc-project-refs` is searchable                |
| `references/misc.md`          | Not a topic                                                  |
| `references/index.md`         | Barrel files are explicitly avoided                          |
| `skills/claude-helper/`       | Reserved word `claude` in name — frontmatter check will fail |

## Deferred-skill convention

Some skills (currently `remotecompose`, `mcp-gateway`) describe v2 work that should not load on routine v1 tasks. Mark the trigger-index entry **"DEFERRED v2"** and write the load conditions in the negative — explicit user mention of the v2 feature. The frontmatter description can use phrases like "Load **only** when the user explicitly mentions ..." to nudge the matcher.

## Pre-merge checklist

Before considering a new or patched skill done:

- [ ] Frontmatter `name` matches `skills/<name>/`.
- [ ] Frontmatter `description` is ≤1024 chars and lists trigger phrases (libraries, commands, error messages).
- [ ] No reserved words (`anthropic`, `claude`) in the name.
- [ ] SKILL.md body is a decision tree, not a manual; depth is in `references/`.
- [ ] Every load-bearing factual claim has an inline URL citation (typebox style).
- [ ] No `## Sources` footer.
- [ ] `AGENTS.md` layered-model table updated.
- [ ] `AGENTS.md` trigger-index row added/updated, with explicit "Load when:" prose.
- [ ] All `references/<topic>.md` files mentioned in the SKILL.md actually exist.
