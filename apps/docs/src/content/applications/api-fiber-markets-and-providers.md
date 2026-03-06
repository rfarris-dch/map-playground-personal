---
title: API Fiber, Markets, And Providers
description: The integration and reporting slices that proxy FiberLocator upstream services and expose paginated market and provider tables.
sources:
  - apps/docs/src/content/applications/api-fiber-markets-and-providers.md
  - apps/api/src/geo/fiber-locator/fiber-locator.route.ts
  - apps/api/src/geo/fiber-locator/fiber-locator.service.ts
  - apps/api/src/geo/fiber-locator/fiber-locator-fetch.service.ts
  - apps/api/src/geo/fiber-locator/fiber-locator-config.service.ts
  - apps/api/src/geo/fiber-locator/fiber-locator-tile-cache.service.ts
  - apps/api/src/geo/fiber-locator/route
  - apps/api/src/geo/markets/markets.route.ts
  - apps/api/src/geo/markets/markets-query.service.ts
  - apps/api/src/geo/markets/markets.repo.ts
  - apps/api/src/geo/providers/providers.route.ts
  - apps/api/src/geo/providers/providers-query.service.ts
  - apps/api/src/geo/providers/providers.repo.ts
---

These slices do not behave like the geometry-heavy map reads in `boundaries`, `facilities`, or `parcels`.

- `fiber-locator` is an upstream integration boundary with proxy validation, retries, and tile caching.
- `markets` and `providers` are reporting-table slices with count + page queries and mapper normalization.

## Fiber locator

### Route surface

`apps/api/src/geo/fiber-locator/fiber-locator.route.ts` registers four endpoints:

- `GET /api/geo/fiber-locator/layers`
- `GET /api/geo/fiber-locator/layers/in-view/:bbox`
- `GET /api/geo/fiber-locator/tile/:layerName/:z/:x/:y.png`
- `GET /api/geo/fiber-locator/vector-tile/:layerName/:z/:x/:y.pbf`

The catalog and layers-in-view routes return JSON envelopes. The tile routes proxy upstream binary content while preserving cache-oriented headers and stamping the request ID.

### Why there is no repo or mapper pair

This slice does not read PostGIS tables directly, so it has no `repo.ts` or mapper equivalent. The service layer is the core seam instead:

| File | Current role |
| --- | --- |
| `fiber-locator-config.service.ts` | Validates required env like `FIBERLOCATOR_API_BASE_URL`, static token, line IDs, and cache settings. |
| `fiber-locator.service.ts` | Builds upstream URLs, filters catalog layers to configured line IDs, fetches layers-in-view, and coordinates tile-cache reads or writes. |
| `fiber-locator-fetch.service.ts` | Handles timeout-aware fetches, retry delays, abort propagation, header passthrough, and snapshot creation for tile responses. |
| `fiber-locator-tile-cache.service.ts` | Stores short-lived tile snapshots and deduplicates in-flight tile fetches. |
| `route/fiber-locator-route-proxy.service.ts` | Validates layer names and tile coordinates, rejects unsupported layers, and turns upstream failures into API-safe responses. |

### Policy and validation boundary

The closest thing to a route-policy layer lives in `route/fiber-locator-route-param.service.ts` and `route/fiber-locator-route-proxy.service.ts`:

- layer names must match a safe character set and a configured allow-list
- `z`, `x`, and `y` must be valid slippy-map coordinates
- tile paths must end in `.png` or `.pbf`
- a missing or invalid fiber config becomes a `503`, not a silent fallback

That is consistent with the repo rule to fail fast rather than degrade to fixture or legacy paths.

## Markets

### Slice shape

`markets` is a classic paginated reporting slice:

1. `markets.route.ts` validates `page`, `pageSize`, `sortBy`, and `sortOrder`.
2. `markets-query.service.ts` orchestrates `countMarkets()` plus `listMarketsPage()`.
3. `markets.repo.ts` executes the SQL against `mirror."HAWK_MARKET"`.
4. `markets.mapper.ts` normalizes nullable database fields into `MarketTableRow` contracts.

### What the query service adds

The query service is not just pass-through wiring. It is the slice-level service boundary that:

- turns Promise failures into a tagged `query_failed` result
- keeps mapping failures separate as `mapping_failed`
- lets the route choose `503` vs `500` without duplicating the orchestration logic

This is the cleanest example of the table-service pattern shared with providers.

## Providers

### Slice shape

`providers` mirrors the markets structure closely:

1. `providers.route.ts` validates pagination and sort parameters.
2. `providers-query.service.ts` composes the count + page reads.
3. `providers.repo.ts` reads from `mirror."HAWK_PROVIDER_PROFILE"`.
4. `providers.mapper.ts` normalizes nullable text, listing counts, boolean flags, and timestamps.

### Why the mapper matters

The repo returns raw DB values like `HYPERSCALE`, `RETAIL`, and `WHOLESALE` flags. The mapper is where those become stable booleans in the shared contract. That keeps route code free of row-shape cleanup.

## Reporting-slice rules

- `markets` and `providers` do not currently need slice-local policy services because the shared pagination helper and sort-schema parsing already cover their transport rules.
- If a future reporting slice gains dataset-specific policy or metadata rules, follow the facilities or parcels pattern and add a small `route/` helper layer rather than inflating the endpoint file.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when the table contract or route builder changes, and use [API Runtime Foundations](/docs/applications/api-runtime) when the change affects shared pagination or response handling.
