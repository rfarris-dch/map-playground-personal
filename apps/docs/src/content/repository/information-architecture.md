---
title: Information Architecture
description: The final docs navigation tree, route prefixes, and source-area ownership for the repository documentation app.
sources:
  - apps/docs/src/features/docs/docs-navigation.service.ts
  - apps/docs/src/content
---

This page records the stable route structure for the docs app. The goal is simple: every meaningful runtime, package, script, and workflow in the repo should have one obvious home in navigation.

```mermaid
flowchart LR
  HOME[Docs Home]
  HOME --> START[Getting Started]
  START --> REPO[Repository]
  REPO --> APPS[Applications]
  APPS --> PKG[Packages]
  PKG --> DATA[Data And Sync]
  DATA --> OPS[Operations]
  OPS --> REF[References]
  REF --> CONTRIB[Contributing]
```

## Final navigation tree

| Section | Route prefix | Purpose |
| --- | --- | --- |
| Getting Started | `/` and `/docs/getting-started/*` | Onboarding, workspace layout, shared commands, and contributor starting points. |
| Repository | `/docs/repository/*` | Architecture boundaries, docs IA, and how the monorepo is divided. |
| Applications | `/docs/applications/*` | Runtime foundations and feature-domain coverage for `apps/web`, `apps/api`, and `apps/pipeline-monitor`. |
| Packages | `/docs/packages/*` | Shared runtime, contract, SQL, tile, ops, bench, and fixture packages under `packages/*`. |
| Data And Sync | `/docs/data-and-sync/*` | Cross-surface data movement, sync lifecycles, and workflow seams shared by scripts, the API worker, and the pipeline monitor. |
| Operations | `/docs/operations/*` | Operational commands, troubleshooting paths, publish, rollback, and incident response guidance. |
| References | `/docs/references/*` | Contracts, API surfaces, workspace maps, and documentation rules that point readers toward the right runtime surfaces. |
| Contributing | `/docs/contributing/*` | Docs authoring standards, parity requirements, and release verification. |

## Section ownership

| Section | Primary repo areas covered |
| --- | --- |
| Getting Started | `README.md`, `AGENTS.md`, root `package.json`, root workspace commands, `apps/docs` quality gates. |
| Repository | `docs/architecture/ddd.qmd`, repo boundary notes, docs route structure, and cross-section organization rules. |
| Applications | `apps/web/**`, `apps/api/**`, `apps/pipeline-monitor/**`. |
| Packages | `packages/contracts/**`, `packages/map-engine/**`, `packages/map-layer-catalog/**`, `packages/map-style/**`, `packages/geo-sql/**`, `packages/geo-tiles/**`, `packages/ops/**`, `packages/bench/**`, `packages/fixtures/**`. |
| Data And Sync | `apps/api/src/sync-worker.ts`, parcel sync services, pipeline monitor tracking features, `scripts/refresh-*.sh`, `scripts/load-parcels-canonical.sh`, tile publish and rollback scripts. |
| Operations | `scripts/**`, API sync status surfaces, and operator-facing recovery procedures. |
| References | `packages/contracts/**`, `apps/api/src/app.ts`, and docs-to-source linking rules. |
| Contributing | `apps/docs/src/content/**`, docs navigation metadata, verification steps, and Tailwind Plus Syntax parity rules. |

## Stable routing rules

- Keep top-level buckets fixed once pages are published.
- Add new pages under the nearest existing section instead of inventing a new top-level group.
- Keep slugs deterministic from the content folder and file stem unless there is a strong reason to override them.
- Preserve the ordered navigation tree in `docs-navigation.service.ts` so search indexing, previous/next links, and browser deep links stay stable.

## Why `Data And Sync` is separate from `Operations`

`Data And Sync` documents how information moves through the repo: extraction, canonical load, tile publish, sync workers, and pipeline monitoring. `Operations` documents what an operator does when those flows fail or need manual intervention. Keeping those concerns separate makes search results, prev/next order, and contributor expectations more predictable.
