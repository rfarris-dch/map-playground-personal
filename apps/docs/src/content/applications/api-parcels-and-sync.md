---
title: API Parcels And Sync
description: The parcel-serving slice and the worker/runtime services that intersect with parcel detail, lookup, enrich, and sync-status responses.
sources:
  - apps/docs/src/content/applications/api-parcels-and-sync.md
  - apps/api/src/geo/parcels/parcels.route.ts
  - apps/api/src/geo/parcels/parcels.repo.ts
  - apps/api/src/geo/parcels/parcels.mapper.ts
  - apps/api/src/geo/parcels/route
  - apps/api/src/sync-worker.ts
  - apps/api/src/sync/parcels-sync.service.ts
  - apps/api/src/sync/hyperscale-sync.service.ts
  - apps/api/src/sync/parcels-sync/application/parcels-sync-loop.application.service.ts
  - apps/api/src/sync/parcels-sync/application/parcels-sync-status-query.service.ts
  - apps/api/src/sync/parcels-sync/application/parcels-sync-store.service.ts
---

`apps/api/src/geo/parcels` is the most operationally sensitive geo slice in the repository. It serves parcel detail and enrichment requests, but it also exposes sync state and enforces coherency rules that tie HTTP reads back to the worker runtime.

## Route inventory

`apps/api/src/geo/parcels/parcels.route.ts` registers four endpoints:

- `GET /api/geo/parcels/sync/status`
- `POST /api/geo/parcels/lookup`
- `POST /api/geo/parcels/enrich`
- `GET /api/geo/parcels/:parcel-id`

That mix is why the slice has the heaviest `route/` helper surface in the API today.

## Core route, repo, and mapper boundaries

### Repo boundary

`apps/api/src/geo/parcels/parcels.repo.ts` delegates parcel SQL construction to `@map-migration/geo-sql`:

- detail reads via `buildParcelDetailQuery()`
- lookup-by-ID reads via `buildParcelLookupByIdsQuery()`
- AOI enrich reads via bbox, polygon, county, and tile-set-aware query builders

The repo stays focused on query execution and parameter passing. It does not decide whether a requested AOI is allowed.

### Mapper boundary

`apps/api/src/geo/parcels/parcels.mapper.ts` converts raw parcel rows into contract features:

- geometry parsing is tolerant of `null` geometry for low-detail modes
- `attrs_json` is normalized into a plain object
- lineage data is attached explicitly, including `sourceOid`, `ingestionRunId`, and source timestamps

That lineage payload is what lets the route layer detect stale client expectations later.

### Route helper boundary

The `apps/api/src/geo/parcels/route` folder is where the slice-specific transport rules live:

| Helper | Current role |
| --- | --- |
| `parcels-route-policy.service.ts` | Enforces bbox width or height caps, max polygon JSON size, and tile-set size limits. |
| `parcels-route-aoi-query.service.ts` | Chooses bbox, polygon, county, or tile-set enrich queries and applies the policy gate before any repo call. |
| `parcels-route-enrich.service.ts` | Clamps page size, paginates `pageSize + 1` query results, and emits truncation warnings with `nextCursor`. |
| `parcels-route-meta.service.ts` | Parses `includeGeometry` and `profile`, builds parcel response metadata, reads expected ingestion-run headers, and decides whether to return a conflict. |
| `parcels-route-errors.service.ts` | Centralizes `BAD_REQUEST`, `POLICY_REJECTED`, `POSTGIS_QUERY_FAILED`, `PARCEL_MAPPING_FAILED`, and ingestion-run mismatch envelopes. |

This is the best reference slice when you need route-local policy and meta logic without pushing those concerns into shared `src/http`.

## Endpoint-specific behavior

### Detail

`parcel-detail.route.ts` is the narrowest parcel read:

- requires parcel-level policy permission from `spatial-analysis-policy.service.ts`
- validates `includeGeometry` and `profile`
- fetches exactly one row
- compares the caller's `ApiHeaders.parcelIngestionRunId` against the feature lineage before returning the payload

If the expected and actual ingestion run IDs diverge, the route returns `409 INGESTION_RUN_MISMATCH` instead of serving stale data optimistically.

### Lookup

`parcels-lookup.route.ts` is the batch-by-ID surface:

- validates the JSON body with contract schemas
- enforces parcel-level query policy
- maps all found rows into features
- emits profile warnings when the requested profile is metadata-only
- performs the same ingestion-run coherency check as detail

### Enrich

`parcels-enrich.route.ts` is the most complex read path:

- validates the AOI payload against contract schemas
- checks dataset policy for `bbox`, `polygon`, `county`, or `tileSet`
- applies AOI-size policy before touching PostGIS
- uses `pageSize + 1` reads so truncation and cursoring are explicit
- carries forward both page-size warnings and profile warnings in the response meta

This route is the main bridge between analysis UIs and the parcel serving backend.

### Sync status

`parcels-sync-status.route.ts` is the parcel slice's operational seam. It reads the latest snapshot from `getParcelsSyncStatusSnapshot()` and selectively redacts internals unless `EXPOSE_SYNC_INTERNALS` is enabled.

That endpoint is the authoritative API input for [Pipeline Monitor](/docs/applications/pipeline-monitor).

## Where the worker runtime intersects with geo serving

### Sync worker entrypoint

`apps/api/src/sync-worker.ts` starts both long-running loops:

- parcel sync via `startParcelsSyncLoop()`
- hyperscale sync via `startHyperscaleSyncLoop()`

The important point for API readers is that parcel-serving routes do not own these loops. They only consume the status and lineage side effects.

### Parcels sync services

The parcel worker path is split into a public bounded-context entrypoint plus application services:

| File | Current role |
| --- | --- |
| `apps/api/src/sync/parcels-sync.service.ts` | Exposes `startParcelsSyncLoop()` and `getParcelsSyncStatusSnapshot()` as the slice-facing public API. |
| `application/parcels-sync-loop.application.service.ts` | Runs startup and interval cycles, executes the sync script, updates runtime state, and refreshes the status store after each run. |
| `application/parcels-sync-status-query.service.ts` | Refreshes the filesystem-backed status store before the HTTP route snapshots it. |
| `application/parcels-sync-store.service.ts` | Owns the singleton `ParcelsSyncStatusStore` and its config refresh lifecycle. |

This is why the sync-status route can stay thin. The route does not inspect files or process logs directly.

### Hyperscale sync intersection

`apps/api/src/sync/hyperscale-sync.service.ts` does not expose an HTTP status route today, but it still intersects with geo serving in two ways:

- the worker starts it beside parcel sync, so both operational loops share process lifecycle and shutdown behavior
- the boundary and facilities SQL reads ultimately depend on the facility and hyperscale serving tables that those refresh scripts maintain

That makes hyperscale sync part of the geo-serving story even without a dedicated `/api/geo/hyperscale/*` slice.

## Reading path for incidents and feature work

- Start with [API Runtime Foundations](/docs/applications/api-runtime) if the issue might live in shared envelopes, middleware, or runtime config.
- Use [Sync Architecture](/docs/data-and-sync/sync-architecture) when the concern crosses scripts, worker loops, parcel routes, and the pipeline monitor.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) for command-level execution and artifact paths.
- Use [Runbooks And Troubleshooting](/docs/operations/runbooks-and-troubleshooting) when a parcel route symptom points to a stalled or failed sync run.
