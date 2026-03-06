# Ralph Progress Log

This file tracks progress across iterations. It's automatically updated
after each iteration and included in agent prompts for context.

## Codebase Patterns (Study These First)

- The docs app treats `apps/docs/src/features/docs/docs-navigation.service.ts` as the authoritative navigation tree. Section order, page order, derived slugs, search grouping, and prev/next links should all be driven from that single definition, while Markdown content stays focused on page content.

---

## 2026-03-06 - docs-1.4
- Implemented the repository information architecture by adding a dedicated `Information Architecture` page under the `Repository` section and a new top-level `Data And Sync` section with a concrete sync-surface page.
- Updated the docs navigation definition so the route tree now explicitly covers onboarding, repository architecture, applications, shared packages, data and sync flows, operations, references, contribution guidance, and migrated artifacts.
- Added minimal Biome workspace wiring to exclude the vendored `docs/tailwind-plus-syntax` reference subtree so `bun x ultracite fix apps/docs docs` and `bun x ultracite check apps/docs docs` can pass against authored docs surfaces.
- Files changed:
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `apps/docs/src/content/repository/architecture.md`
  - `apps/docs/src/content/repository/information-architecture.md`
  - `apps/docs/src/content/data-and-sync/sync-architecture.md`
  - `biome.json`
- **Learnings:**
  - The docs IA is already encoded structurally through folder-based content discovery plus navigation metadata, so adding or reshaping top-level sections should happen in `docs-navigation.service.ts` first and then be documented in content.
  - The vendored Tailwind Plus Syntax reference under `docs/tailwind-plus-syntax` is not Biome-clean under this repo’s Ultracite rules, so checks that target `docs/` need that subtree excluded unless the intent is to lint and refactor the upstream template itself.
  - Browser automation was attempted, but `agent-browser` could not start its daemon in this sandbox and local preview servers are blocked from binding to a port here.
---
