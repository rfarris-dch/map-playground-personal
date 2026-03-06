---
title: API Boundaries And Facilities
description: The PostGIS-backed geo-serving slices for power boundaries and facility reads, including the route, repo, mapper, and route-helper seams.
sources:
  - apps/docs/src/content/applications/api-boundaries-and-facilities.md
  - apps/api/src/geo/boundaries/boundaries.route.ts
  - apps/api/src/geo/boundaries/boundaries.repo.ts
  - apps/api/src/geo/boundaries/boundaries.mapper.ts
  - apps/api/src/geo/facilities/facilities.route.ts
  - apps/api/src/geo/facilities/facilities.repo.ts
  - apps/api/src/geo/facilities/facilities.mapper.ts
  - apps/api/src/geo/facilities/facilities-table.mapper.ts
  - apps/api/src/geo/facilities/route
---

These two slices are both PostGIS-backed, but they are not the same size. `boundaries` is the minimal route -> repo -> mapper shape. `facilities` is the larger multi-endpoint slice that adds route-local services for policy, truncation, pagination, and error handling.

## Boundaries

### Route boundary

`apps/api/src/geo/boundaries/boundaries.route.ts` owns the full transport flow for `GET /api/geo/boundaries/power`:

- reads the optional `level` query param and defaults it to `county`
- rejects invalid levels before any database work
- translates repo failures into `POSTGIS_QUERY_FAILED`
- translates mapper failures into `BOUNDARY_MAPPING_FAILED`
- stamps the response with `sourceMode`, `dataVersion`, `recordCount`, and `generatedAt`

This slice does not need a `route/` helper folder because the transport surface is small enough to stay coherent in one file.

### Repo boundary

`apps/api/src/geo/boundaries/boundaries.repo.ts` owns the SQL, not the route:

- builds a shared facility-power CTE from `serve.facility_site` and `serve.hyperscale_site`
- chooses county, state, or country aggregation SQL based on the parsed level
- reads from the `serve.admin_county_geom_lod*` geometry tables
- returns raw rows with `geom_json`, IDs, labels, and commissioned MW totals

The important design point is that the repo returns raw database rows, not contract-ready GeoJSON features.

### Mapper boundary

`apps/api/src/geo/boundaries/boundaries.mapper.ts` is the contract-normalization layer:

- parses the GeoJSON geometry payload
- validates required labels and non-negative power values
- attaches the requested aggregation level to the feature properties
- produces `BoundaryPowerFeature[]` for the route envelope

That means the route never has to know how database field names map to the public contract.

## Facilities

### Why the facilities slice is larger

`apps/api/src/geo/facilities` serves four different interaction modes:

- `GET /api/geo/facilities` for bbox-driven map fetches
- `POST /api/geo/facilities/selection` for polygon selection across perspectives
- `GET /api/geo/facilities/table` for paginated reporting
- `GET /api/geo/facilities/:facility-id` for detail reads

Because those endpoints share perspective parsing, error handling, meta generation, and query orchestration, the slice splits route helpers into `apps/api/src/geo/facilities/route/*`.

### Route composition

`apps/api/src/geo/facilities/facilities.route.ts` is intentionally just the registration layer. The per-endpoint route files stay focused:

| Route file | Responsibility |
| --- | --- |
| `facilities-bbox.route.ts` | Parses `bbox`, perspective, and `limit`; returns truncated map features with warnings when needed. |
| `facilities-selection.route.ts` | Reads the JSON selection payload, enforces polygon-size and bbox policy, queries each perspective, and merges the result set. |
| `facilities-table.route.ts` | Applies shared pagination, perspective, and sort parsing for the table response. |
| `facilities-detail.route.ts` | Validates the path param, reads one feature, and returns `404` when the facility does not exist. |

### Route helper services

The helper files under `apps/api/src/geo/facilities/route` define the slice boundary more clearly than the route entrypoints alone:

| Helper | Current role |
| --- | --- |
| `facilities-route-param.service.ts` | Parses `perspective`, table sort fields, sort direction, and clamped limits. |
| `facilities-route-policy.service.ts` | Enforces selection AOI policy, including max polygon JSON size and bbox width or height limits. |
| `facilities-route-query.service.ts` | Orchestrates repo reads plus mapping, applies the `limit + 1` truncation pattern, and converts errors into typed result unions. |
| `facilities-route-meta.service.ts` | Stamps the shared facilities response metadata with runtime source-mode and data-version values. |
| `facilities-route-errors.service.ts` | Centralizes the repeated JSON error shapes for query and mapping failures. |

This is the main transport-heavy slice in the API today besides parcels.

### Repo and SQL boundary

`apps/api/src/geo/facilities/facilities.repo.ts` keeps the actual reads separate from the routes:

- bbox and polygon queries are delegated to `@map-migration/geo-sql`
- detail queries also come from `@map-migration/geo-sql`
- table reads are written inline because the colocation and hyperscale tables diverge slightly
- count queries are perspective-specific so the table route can return total pagination metadata

The repo is also where max-row limits are pulled from the geo-SQL query specs, which lets the route helpers clamp request limits without duplicating SQL knowledge.

### Mapper boundary

Facilities use two mappers because the public shapes differ:

| File | Output shape |
| --- | --- |
| `facilities.mapper.ts` | Map and detail features with point geometry, provider labels, perspective, and power attributes. |
| `facilities-table.mapper.ts` | Flat table rows with nullable fields normalized for the reporting routes. |

The most important nuance is provider naming. Hyperscale rows sometimes surface provider identifiers that are not user-facing names, so the feature mapper has fallback logic that derives a readable provider label from the facility name when necessary.

## What to remember when editing these slices

- `boundaries` is the clean example of a small slice. Add helper files only if the route stops being readable.
- `facilities` already has the richer transport split, so new validation or query orchestration belongs in the `route/` services before it belongs in the endpoint file.
- Both slices rely on [API Runtime Foundations](/docs/applications/api-runtime) for response envelopes, runtime config, and shared request parsing.
- Facilities also cross-link strongly to [Geo SQL](/docs/packages/geo-sql) because the spatial query builders live in the package, not inside the app repo folder.
