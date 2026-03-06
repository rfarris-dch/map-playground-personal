---
title: Contracts And API Surfaces
description: Shared transport schemas, response-envelope patterns, and the repo sources that anchor the API documentation.
sources:
  - packages/contracts/src/index.ts
  - packages/contracts/src/api-contracts.ts
  - packages/contracts/src/shared-contracts.ts
  - packages/contracts/test/openapi-envelope-contracts.test.ts
  - apps/api/src/app.ts
  - docs/architecture/spatial-analysis-openapi.yaml
---

This repo keeps its API and transport contract definitions centralized. The important distinction is between authoritative transport sources and explanatory docs.

## Shared contracts package

`packages/contracts/src/index.ts` re-exports the current schema modules:

- `analysis-contracts`
- `api-contracts`
- `boundaries-contracts`
- `facilities-contracts`
- `fiber-locator-contracts`
- `parcels-contracts`
- `shared-contracts`
- `table-contracts`

## Transport source-of-truth map

| Source file | Why it is authoritative |
| --- | --- |
| `packages/contracts/src/index.ts` | Defines the package export surface that downstream apps and packages actually import. |
| `packages/contracts/src/api-contracts.ts` | Owns route constants, route builders, request headers, and shared query defaults. |
| `packages/contracts/src/shared-contracts.ts` | Owns the shared envelope, geometry, bbox, enum, and parse-helper surface reused across domain modules. |
| `apps/api/src/app.ts` | Registers the public HTTP routes that are currently live in the API runtime. |
| `packages/contracts/test/openapi-envelope-contracts.test.ts` | Enforces that the vendored OpenAPI fixture still matches runtime routes, headers, defaults, and shared envelope structure. |
| `docs/architecture/spatial-analysis-openapi.yaml` | Reference YAML for the currently documented health, parcels, and facilities endpoints. |

## Current API surface patterns

### Envelopes

The API runtime uses shared JSON response helpers in `apps/api/src/http/api-response.ts`, while route and schema shapes come from `packages/contracts`.

### Routes

`apps/api/src/app.ts` is the authoritative registration point for the current public HTTP surface.

### Validation

Each route slice parses request data and returns contract-backed payloads before the response leaves the API runtime.

## Current shared transport coverage

The transport package is split by runtime concern rather than by app:

| Contract module | Current repo responsibility |
| --- | --- |
| `shared-contracts` | Shared headers, `ResponseMetaSchema`, `ApiErrorResponseSchema`, geometry helpers, bbox parsing, and shared enums such as `SourceMode`. |
| `api-contracts` | `ApiRoutes`, `ApiHeaders`, `ApiDefaults`, `ApiQueryDefaults`, and the route-builder helpers used by API, web, and pipeline runtimes. |
| `analysis-contracts` | Spatial-analysis payloads and policy-driven envelope shapes. |
| `boundaries-contracts` | Boundary power query types and GeoJSON response shapes. |
| `facilities-contracts` | Facilities bbox, selection, and detail payloads. |
| `fiber-locator-contracts` | Fiber layer catalog and in-view/tile response contracts. |
| `parcels-contracts` | Parcel detail, AOI, enrich, lookup, and sync-status request and response schemas. |
| `table-contracts` | Table-query pagination, sorting, and tabular result shapes for facilities, markets, and providers. |

## OpenAPI reference

The current in-repo OpenAPI YAML is `docs/architecture/spatial-analysis-openapi.yaml`. Treat it as a reference file that should stay aligned with the shared contracts and route behavior as the spatial-analysis surface evolves.

The strongest alignment point in the repo today is `packages/contracts/test/openapi-envelope-contracts.test.ts`. That test verifies several concrete seams against the vendored fixture:

- shared envelope schemas are present
- runtime routes match `ApiRoutes`
- request headers and parcel-detail query defaults match `ApiHeaders` and `ApiQueryDefaults`
- parcel-detail conflict responses still map to `ApiErrorResponse`
- polygon AOIs and facility fields still match the runtime schema shape

## How to use this page

- Start here when a change affects request or response shapes.
- Use the app and slice docs when you need runtime ownership and implementation context.

:::note Reference Pattern
The authoritative source for exact runtime behavior is still the code in `packages/contracts` and `apps/api`. The OpenAPI YAML is a useful reference file, not a substitute for the live contract package.
:::
