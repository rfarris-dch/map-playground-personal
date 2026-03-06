---
title: API Geo Slices
description: The geo-serving route groups under apps/api/src/geo and the route, repo, mapper, service, and policy seams they use.
sources:
  - apps/docs/src/content/applications/api-geo-slices.md
  - apps/api/src/app.ts
  - apps/api/src/geo/boundaries
  - apps/api/src/geo/facilities
  - apps/api/src/geo/fiber-locator
  - apps/api/src/geo/markets
  - apps/api/src/geo/parcels
  - apps/api/src/geo/providers
---

The bottom of `apps/api/src/app.ts` registers six geo-serving slices. They share the same Hono middleware, response envelopes, pagination helpers, runtime config, and Postgres client, but the internal slice shape is intentionally not uniform.

This route is the reading guide. The detailed pages below split the surface by runtime shape so the docs stay readable as the API grows.

## Slice map

| Docs page | Slices | Dominant shape | What to look for first |
| --- | --- | --- | --- |
| [API Boundaries And Facilities](/docs/applications/api-boundaries-and-facilities) | `boundaries`, `facilities` | PostGIS-backed geo reads | Repo queries, contract mappers, and route-level transport helpers |
| [API Fiber, Markets, And Providers](/docs/applications/api-fiber-markets-and-providers) | `fiber-locator`, `markets`, `providers` | Upstream proxy plus paginated reporting tables | Config and fetch services for fiber, query-service pipelines for tables |
| [API Parcels And Sync](/docs/applications/api-parcels-and-sync) | `parcels` plus sync intersections | Policy-heavy geo serving tied to worker state | AOI policy helpers, ingestion-run metadata, sync status seams, worker services |

## What stays shared vs slice-local

### Shared runtime surface

[API Runtime Foundations](/docs/applications/api-runtime) owns the transport rules every slice inherits:

- Hono app construction and middleware registration
- request ID propagation and JSON envelope shaping
- request timeout and body-size hardening
- runtime config and Bun SQL lifecycle
- dataset-level policy helpers in `apps/api/src/http`

### Slice-local surface

Each folder under `apps/api/src/geo` owns the domain logic that is not generic enough for `src/http`:

- route registration and endpoint-specific validation
- repo/query code for slice-specific reads
- mappers that normalize database or upstream payloads into contracts
- policy, meta, or error helpers when the slice has nontrivial transport behavior

## Repeated slice patterns

### Compact route -> repo -> mapper slices

`boundaries` is the smallest example. The route validates one query param, the repo executes one of three SQL shapes, and the mapper turns rows into a feature collection.

### Multi-endpoint transport slices

`facilities` and `parcels` both break route behavior into small helpers under `route/`:

- param parsing
- policy checks
- response meta builders
- query orchestration
- shared error responses

That keeps the entry route files small even though each slice serves several endpoints.

### Service-first slices

`fiber-locator` is not a PostGIS slice. Its main value lives in env-driven config, upstream fetch behavior, tile proxy validation, caching, and retry handling.

### Paginated reporting slices

`markets` and `providers` both use the same shape:

1. route validates pagination and sort params
2. query service orchestrates count + page reads
3. repo executes SQL against mirror tables
4. mapper normalizes nullable database fields into contract rows

## Operational seam

Only the parcel slice exposes the sync worker directly to HTTP readers through `GET /api/geo/parcels/sync/status`. That makes parcels the place where geo serving, sync lifecycle, pipeline monitoring, and operator recovery intersect most tightly.

Use these pages together with:

- [API Runtime Foundations](/docs/applications/api-runtime)
- [Sync Architecture](/docs/data-and-sync/sync-architecture)
- [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows)
- [Troubleshooting And Recovery](/docs/operations/troubleshooting-and-recovery)
