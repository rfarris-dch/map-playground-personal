---
title: Geo SQL
description: Shared SQL query specs and builders for facilities and parcel reads on the API serving path.
sources:
  - packages/geo-sql/package.json
  - packages/geo-sql/src/index.ts
  - packages/geo-sql/src/index.types.ts
  - packages/geo-sql/test/query-specs.test.ts
  - apps/api/src/geo/facilities/facilities.repo.ts
  - apps/api/src/geo/parcels/parcels.repo.ts
---

`packages/geo-sql` is the API repo layer's shared SQL contract package. Instead of hiding query text inside each route slice, it keeps the named query specs, row-budget metadata, and parameter builders in one workspace package that both facilities and parcels can consume.

## Purpose and package boundary

- `packages/geo-sql/src/index.ts` holds the query registry and the public builders.
- `packages/geo-sql/src/index.types.ts` defines the bbox, polygon, parcel-enrich, and SQL-spec contracts used by those builders.
- The package depends on `@map-migration/contracts` for shared enums such as `FacilityPerspective` and `ParcelGeometryMode`, which keeps the SQL layer aligned with the transport layer.
- The package does not execute queries itself. `apps/api` still owns database connectivity through `runQuery()` and slice-specific row mappers.

## Key exported responsibilities

### Facilities query specs

The facilities half of the package exposes both metadata and executable SQL builders:

- `getFacilitiesBboxQuerySpec()` and `getFacilitiesPolygonQuerySpec()` expose `endpointClass`, `maxRows`, and the canonical SQL text for each facilities perspective.
- `buildFacilitiesBboxQuery()` and `buildFacilitiesPolygonQuery()` turn request arguments into `{ sql, params }` pairs ready for `runQuery()`.
- `buildFacilityDetailQuery()` centralizes the single-row detail query for both colocation and hyperscale facility tables.

The underlying registry keeps the two perspectives aligned on row caps and query class while still switching between `serve.facility_site` and `serve.hyperscale_site`.

### Parcel query builders

The parcel half of the package wraps the canonical table and geometry-shape choices:

- `buildParcelDetailQuery()` and `buildParcelLookupByIdsQuery()` serve point lookup and selected-parcel fetches.
- `buildParcelsEnrichByBboxQuery()`, `buildParcelsEnrichByPolygonQuery()`, and `buildParcelsEnrichByCountyQuery()` drive the parcel enrich flow.
- `parcelGeometryExpression()` and `buildParcelSelect()` keep the geometry-mode decision in one place so `none`, `centroid`, `simplified`, and full geometry stay consistent.

That makes `parcel_current.parcels` and the geometry-shaping logic explicit shared infrastructure instead of being duplicated in multiple API files.

### Query-spec metadata

`SqlQuerySpec` exposes two important operational hints alongside the SQL text:

- `endpointClass` ties the query to runtime budget classes such as `feature-collection`, `boundary-aggregation`, or `proximity-enrichment`.
- `maxRows` gives the API layer one shared row-budget value to enforce or expose.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/api/src/geo/facilities/facilities.repo.ts` | Uses the facilities query builders and the `maxRows` spec helpers for bbox, polygon, and detail reads. |
| `apps/api/src/geo/parcels/parcels.repo.ts` | Uses the parcel detail, lookup, and enrich builders before executing them through the shared Postgres adapter. |
| `packages/contracts` | Supplies the shared enums and geometry-mode types that this package imports so query behavior matches the public transport layer. |

The package currently has no direct frontend or script consumers. Its public role is to keep API read queries centralized and typed.

## Query responsibility in this repo

- `geo-sql` owns reusable read-query structure, row limits, and SQL text.
- `apps/api` repo files own query execution and slice-local row typing.
- route handlers own request parsing, policy checks, and response-envelope construction.

That split is why the package belongs in `packages/` rather than under a single `apps/api/src/geo/*` slice.

## Tests and build behavior

`packages/geo-sql/package.json` defines the standard shared-package scripts:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `bun test`

`test/query-specs.test.ts` covers the main invariants that matter for this package:

- each public query spec has a valid `endpointClass`, positive `maxRows`, and non-empty SQL text
- perspective-specific facilities queries keep row budgets aligned
- public builders return parameter arrays without exposing internal registry names
- facilities queries preserve `provider_id IS NOT NULL` filtering and the provider-name fallback logic

The current tests are query-contract tests, not database integration tests. They validate the generated SQL and metadata shape without needing a live Postgres instance.

## Related docs

- Use [API Geo Slices](/docs/applications/api-geo-slices) for the route and repo layers that consume these builders.
- Use [API Runtime Foundations](/docs/applications/api-runtime) for the database and HTTP runtime beneath those slices.
- Use [Contracts](/docs/packages/contracts) when a query argument or geometry mode needs to stay aligned with the transport schemas.
