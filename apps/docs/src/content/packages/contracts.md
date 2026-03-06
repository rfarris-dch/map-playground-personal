---
title: Contracts
description: Shared Zod-backed transport schemas, route builders, and response-envelope helpers used across API, web, and pipeline runtimes.
---

`packages/contracts` is the repo's transport contract boundary. It is where shared request and response schemas, route builders, headers, defaults, and parser helpers live before they are consumed by any individual app runtime.

## Purpose and package boundary

- The package re-exports eight domain modules from `packages/contracts/src/index.ts`: `analysis-contracts`, `api-contracts`, `boundaries-contracts`, `facilities-contracts`, `fiber-locator-contracts`, `parcels-contracts`, `shared-contracts`, and `table-contracts`.
- The package uses Zod as the runtime validation boundary and publishes both schemas and inferred TypeScript types.
- When route paths, request payloads, response envelopes, or cross-app enums need to stay aligned, the change belongs here before it belongs in app-local helpers.

## Key exported responsibilities

### Shared envelope and primitive contracts

`packages/contracts/src/shared-contracts.ts` defines the transport primitives reused everywhere else:

- `ResponseMetaSchema` and `ApiErrorResponseSchema` for success and error envelopes
- `ApiHeaders` request/response header names such as `x-request-id`
- `BBoxSchema`, `GeometrySchema`, `PolygonGeometrySchema`, and related parse helpers
- enums such as `SourceMode`, `FacilityPerspective`, `CommissionedSemantic`, and `LeaseOrOwn`

### Route builders and API defaults

`packages/contracts/src/api-contracts.ts` defines the repo's route-builder surface:

- `ApiRoutes` for the current public HTTP paths
- `ApiQueryDefaults` and `ApiDefaults` for shared default behavior
- route helpers such as `buildFacilitiesBboxRoute()`, `buildMarketsRoute()`, `buildProvidersRoute()`, `buildParcelDetailRoute()`, and `buildFiberLocatorVectorTileRoute()`
- `resolveDataVersion()` for shared data-version resolution logic

### Domain response and request shapes

The domain modules define the payloads that the API produces and the frontend parses:

| Module | Concrete runtime surface |
| --- | --- |
| `analysis-contracts` | Parcel scoring, proximity, market metric policy, and shared analysis error envelopes. |
| `boundaries-contracts` | Boundary power query level parsing plus `BoundaryPowerFeatureCollection`. |
| `facilities-contracts` | Facilities bbox, selection, and detail payloads. |
| `fiber-locator-contracts` | Fiber catalog payloads and in-view line layer responses. |
| `parcels-contracts` | Parcel detail, AOI, enrich, lookup, and sync-status contracts. |
| `table-contracts` | Market, provider, and facilities table rows, pagination, and sort enums. |

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/api` | Imports shared route constants, request/query types, response schemas, and metadata helpers across `src/app.ts`, `src/http/*`, and the `src/geo/*` route slices. |
| `apps/web` | Uses route builders and schemas in `src/lib/api-client.ts` and feature APIs such as `features/facilities/api.ts`, `features/markets/markets.api.ts`, `features/providers/providers.api.ts`, and `features/fiber-locator/fiber-locator.layer.ts`. |
| `apps/pipeline-monitor` | Uses `buildParcelsSyncStatusRoute()`, `ApiHeaders`, `ParcelSyncPhase`, and `ParcelsSyncStatusResponseSchema` in `src/features/pipeline/pipeline.service.ts`. |
| `packages/geo-sql` | Reuses contract enums and query argument types such as `FacilityPerspective` and `ParcelGeometryMode` so query specs stay aligned with the transport layer. |

## Contract-sharing patterns in this repo

- `shared-contracts.ts` holds low-level primitives and shared metadata instead of duplicating them in every domain module.
- `api-contracts.ts` is the single route-builder surface, which keeps the frontend, pipeline monitor, tests, and reference docs aligned on the same URL patterns.
- Each domain module pairs runtime schemas with a `*.types.ts` file so the type exports stay inference-backed rather than hand-maintained.
- API runtimes should validate and emit these schemas, while docs and OpenAPI artifacts should describe them without becoming the source of truth.

## Tests and build behavior

`packages/contracts/package.json` is stricter than the other runtime packages because it is the transport seam:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `test`: `bun test`
- `verify:openapi`: targeted OpenAPI alignment test
- `ci:check`: typecheck plus tests

The current test suite covers several distinct risks:

- `test/api-route-contracts.test.ts` verifies route builders and query defaults.
- `test/analysis-envelope-contracts.test.ts` verifies shared success and error envelope behavior.
- `test/analysis-policy-contracts.test.ts` verifies policy and licensing payload constraints.
- `test/parcels-aoi-contracts.test.ts` verifies bbox, polygon, and tile-set AOI validation.
- `test/openapi-envelope-contracts.test.ts` checks alignment between runtime routes/contracts and the vendored OpenAPI fixture.

## Related docs

- Use [API Runtime Foundations](/docs/applications/api-runtime) for the process-level runtime that emits these contracts.
- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the frontend call sites that consume these route builders and schemas.
- Use [Pipeline Monitor](/docs/applications/pipeline-monitor) for the parcel sync UI that depends on the same contract surface.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) for the reference-oriented companion page.
