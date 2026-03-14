---
title: Data And Operations Packages
description: Shared SQL, tile, and ops packages used across serving and operational workflows.
---

The remaining shared packages sit closer to data access, publish artifacts, runtime observability, and performance framing than to end-user UI. They are still part of the monorepo's runtime story because the API, the parcel tile flow, and the operator surfaces depend on their contracts staying stable.

## Package map

| Package | Purpose | Current consumers |
| --- | --- | --- |
| `packages/geo-sql` | Shared query-spec and SQL-builder package for facilities and parcel reads. | `apps/api/src/geo/facilities/facilities.repo.ts`, `apps/api/src/geo/parcels/parcels.repo.ts`. |
| `packages/geo-tiles` | Tile dataset parsing and manifest invariants for parcel PMTiles publication and frontend tile lineage. | `apps/web/src/features/parcels/parcels.service.ts`, `apps/web/src/features/parcels/parcels.layer.ts`, `scripts/publish-parcels-manifest.ts`, `scripts/rollback-parcels-manifest.ts`. |
| `packages/ops` | Shared request-ID and diagnostic-event helpers that keep operational metadata consistent. | `apps/api/src/app.ts`, `apps/api/src/http/api-response.ts`, `apps/web/src/lib/api-client.ts`, `apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts`. |

## Runtime shape across this package group

- `geo-sql` and `geo-tiles` are the two packages in this section with active production-path usage today. They are directly on the parcel and facilities serving path.
- `ops` is smaller, but it crosses all three app runtimes because request IDs and operational event metadata must stay aligned.

## Package detail pages

- Use [Geo SQL](/docs/packages/geo-sql) for the facilities and parcel SQL builders that the API repo layer executes.
- Use [Geo Tiles](/docs/packages/geo-tiles) for manifest parsing, version creation, and tile publish invariants.
- Use [Ops](/docs/packages/ops) for request IDs and shared diagnostic-event shapes.

## Related docs

- Use [API Runtime Foundations](/docs/applications/api-runtime) and [API Geo Slices](/docs/applications/api-geo-slices) for the application code that executes `geo-sql`.
- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the parcel runtime and request helpers that consume `geo-tiles` and `ops`.
- Use [Pipeline Monitor](/docs/applications/pipeline-monitor) for the operator client that also uses `ops`.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) for the scripts that exercise the tile package in production.
