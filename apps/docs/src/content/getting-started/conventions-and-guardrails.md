---
title: Conventions And Guardrails
description: The repository rules in AGENTS.md that shape how code, docs, and operational changes are expected to land in this workspace.
sources:
  - AGENTS.md
  - README.md
  - apps/web/README.md
  - apps/api/README.md
searchTerms:
  - AGENTS rules
  - codex guardrails
  - repo conventions
  - ultracite
---

`AGENTS.md` is the highest-signal repository conventions file after the root README. It does not describe product behavior. It describes how changes are expected to be made so the codebase stays consistent.

## Why this file matters

Use `AGENTS.md` whenever a change touches:

- formatting and linting
- Vue or frontend module layout
- file naming
- exports and barrel structure
- type-safety conventions
- runtime fallback behavior

If a change conflicts with these rules, the conflict should be explicit instead of accidental.

## Rules that affect nearly every change

### Ultracite and Biome

The repo treats Ultracite as the enforcement layer for formatting and lint policy:

- keep Biome aligned with `ultracite/biome/core` and `ultracite/biome/vue`
- run `bun x ultracite fix`
- confirm `bun x ultracite check` passes before finishing

This is why docs work in `apps/docs` is expected to follow the same verification path as product apps.

### No pass-through export wrappers

Do not create files that only re-export from another file unless the barrel adds real grouping value. The practical effect is:

- prefer importing from the real module or the nearest meaningful barrel
- remove single-line re-export files that add no boundary or organization value
- avoid adding deep-path passthrough exports when a local domain barrel already exists

### Kebab-case paths

Repository paths stay kebab-case even when symbols are PascalCase in code. This matters most in Vue work:

- component symbols can be `LayoutShell`
- the file path still needs to be `layout-shell.vue`

### Feature module split rules

The frontend conventions are explicit:

- feature entry files should stay focused on orchestration
- colocated `*.types.ts` files hold feature contracts
- colocated `*.service.ts` files hold reusable pure helpers

That is the same split the docs app now uses under `apps/docs/src/features/docs`.

## Type-safety expectations

The repo has two strong preferences:

1. avoid type assertions when safe narrowing is possible
2. prefer `readonly` contracts and `const` bindings by default

That bias shows up across product apps and should also apply to docs code, especially in content registries and navigation metadata.

## Production-path bias

One of the most important repo rules is "no fallbacks or legacy paths" unless a migration path is explicitly requested.

In practice that means:

- do not silently degrade to fixtures
- do not keep dead compatibility branches around
- fail fast when required infrastructure is missing
- document the real production path instead of alternative speculative paths

This rule is especially important in the operations and parcel-sync docs because those pages should describe the actual supported command path, not every imaginable workaround.

## How these rules map to the docs app

The docs surface should follow the same discipline as the product surfaces:

| Repo rule | What it means for docs work |
| --- | --- |
| Keep entry files orchestration-focused | `app.vue`, route views, and shell components stay thin while content parsing and navigation logic live in services or composables. |
| Keep one production path | docs pages should describe the current supported runtime and script path, not alternate legacy stories. |
| Prefer real module boundaries | authored pages should point to real source files in frontmatter `sources`, not vague folder names only. |
| Verify with Ultracite | docs work is expected to pass the same lint and formatting checks as code. |

## Related reading

- [Start Here](/docs/) for the quick path through the repo.
- [Workspace And Commands](/docs/getting-started/workspace-and-commands) for the command inventory these rules sit on top of.
- [Docs Authoring](/docs/contributing/docs-authoring) for how these repo rules translate into docs-specific editing guidance.
