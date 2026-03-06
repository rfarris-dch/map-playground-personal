---
title: Workspace Source Map
description: A route-by-route and folder-by-folder map of the repo so readers can jump from docs pages to the exact source areas that own the behavior being described.
sources:
  - README.md
  - AGENTS.md
  - apps/web/README.md
  - apps/api/README.md
  - apps/docs/src/features/docs/docs-navigation.service.ts
searchTerms:
  - workspace map
  - source map
  - top level folders
  - where to look
---

This page is a direct source-reading aid. Use it when you already know the topic but do not remember which top-level folder actually owns it.

## Top-level map

| Path | What it owns |
| --- | --- |
| `apps/web` | The interactive map app plus reporting routes for markets, providers, and facilities. |
| `apps/api` | The HTTP geo service plus the background sync worker. |
| `apps/pipeline-monitor` | Operator-facing status UI for parcel pipeline progress. |
| `apps/docs` | This documentation app. |
| `packages/contracts` | Shared transport schemas and route builders. |
| `packages/map-engine` | The map-engine abstraction used by the web shell. |
| `packages/map-layer-catalog` | Canonical layer IDs, dependency rules, and visibility defaults. |
| `packages/map-style` | Shared style-layer identity and ordering helpers. |
| `packages/geo-sql` | Query-oriented shared SQL surfaces. |
| `packages/geo-tiles` | Tile-manifest and publish helpers. |
| `packages/ops` | Shared operational utilities such as request IDs. |
| `scripts` | Operational entrypoints for sync, canonical load, build, publish, and rollback. |
| `docs` | Legacy architecture, research, review, planning, and task source material. |

## If you are changing...

### Frontend runtime behavior

Start in:

- `apps/web/src/pages`
- `apps/web/src/features/app`
- `apps/web/src/features/*`

Then jump to:

- `packages/contracts`
- `packages/map-engine`
- `packages/map-layer-catalog`
- `packages/map-style`

### Backend route or query behavior

Start in:

- `apps/api/src/app.ts`
- `apps/api/src/geo`
- `apps/api/src/http`

Then jump to:

- `packages/contracts`
- `packages/geo-sql`
- `scripts` for operational dependencies

### Parcel sync or publish behavior

Start in:

- `apps/api/src/sync-worker.ts`
- `apps/api/src/sync/parcels-sync`
- `scripts/refresh-parcels.sh`
- `scripts/load-parcels-canonical.sh`
- `scripts/build-parcels-draw-pmtiles.sh`
- `scripts/publish-parcels-manifest.ts`
- `scripts/rollback-parcels-manifest.ts`

### Docs behavior

Start in:

- `apps/docs/src/features/docs`
- `apps/docs/src/content`
- `docs/*` for legacy source material

## Navigation rule of thumb

Use the docs app to find the right source area, then switch to the source files when implementation detail matters. The docs page gives the reading order. The source map gives the owning path.

## Related reading

- [Repository Architecture](/docs/repository/architecture)
- [Information Architecture](/docs/repository/information-architecture)
