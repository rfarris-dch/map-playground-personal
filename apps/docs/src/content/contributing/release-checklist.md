---
title: Release Checklist
description: Final parity and integrity checks for the docs app before shipping changes.
searchTerms:
  - docs release
  - syntax parity
  - browser verification
  - final QA
---

Use this checklist before treating the docs app as releasable.

The live coverage audit below validates representative docs routes against the actual navigation tree and search index. Use the rest of this page for the browser pass, parity review, and scope checks that still require a human reviewer.

## Tailwind Plus Syntax parity targets

Compare the Vue docs app against the in-repo reference implementation under `docs/tailwind-plus-syntax/syntax-ts`.

- Visual tokens and prose styles: `src/styles/tailwind.css` and `src/styles/prism.css`
- App-shell structure and hero treatment: `src/app/page.tsx` and `src/app/layout.tsx`
- Shared docs shell components: `src/components/*`
- Navigation grouping: `src/lib/navigation.ts`
- Table-of-contents extraction: `src/lib/sections.ts`

## Required browser pass

Verify these routes with `agent-browser` at desktop (`1440x900`) and mobile (`390x844`):

| Surface | Route | What to confirm |
| --- | --- | --- |
| Homepage | `/` | Hero parity, shell layout, desktop navigation, light/dark theme toggle |
| Deep docs page | `/docs/applications/api-geo-slices` | Long-form prose, TOC tracking, prev/next links, code fences |
| Operations page | `/docs/operations/parcel-and-tile-workflows` | Large-page readability, callouts, tables, and command structure |
| Mermaid page | `/docs/data-and-sync/sync-architecture` | Mermaid charts render as diagrams in light and dark mode instead of raw fenced code |
| Data and sync detail page | `/docs/data-and-sync/parcels-sync-status-and-files` | File-based status guidance, tables, and related links render cleanly inside the shell |

Capture final screenshots for:

- homepage
- deep docs page
- search flow
- mobile navigation flow

## Search and route integrity

Run these checks during the browser pass:

- Search keyboard shortcut opens the modal.
- Query `workspace commands` returns `Workspace And Commands`.
- Query `pipeline monitor` returns `Pipeline Monitor`.
- Query `parcel tile workflows` returns `Parcel And Tile Workflows`.
- Query `contracts and api surfaces` returns `Contracts And API Surfaces`.
- Deep links from search preserve hash fragments when a section-level match is selected.
- Table of contents highlights the active section on long pages.
- Previous and next links follow `docs-navigation.service.ts` order.
- Mermaid pages render SVG output rather than literal ```mermaid blocks.

## Content integrity

- Onboarding pages cover workspace layout, shared commands, and contributor starting points.
- Application pages cover `apps/web`, `apps/api`, and `apps/pipeline-monitor`.
- Package pages cover the current shared packages.
- Operations pages cover scripts, troubleshooting paths, and recovery guidance.
- Contributing pages explain how authored docs are added, ordered, and verified.

## Scope and safety checks

- Docs work is limited to docs surfaces plus minimal workspace wiring.
- No business behavior changed in `apps/web`, `apps/api`, `apps/pipeline-monitor`, `packages/*`, or production scripts.
- Source references still point to real files and real operational paths.

Use `git diff --name-only` before release review. The changed paths should stay inside `apps/docs/**`, `docs/**`, and any intentionally minimal workspace wiring such as root `package.json`, `turbo.json`, or `biome.json`.

## Required commands

```bash
bun --cwd apps/docs lint
bun --cwd apps/docs typecheck
bun --cwd apps/docs build
bun x ultracite fix apps/docs docs
bun x ultracite check apps/docs docs
```
