---
title: Contracts And API Surfaces
description: Shared transport schemas, response-envelope patterns, and the OpenAPI artifact that anchor the repo’s API documentation.
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

## Current API surface patterns

### Envelopes

The API runtime uses shared JSON response helpers in `apps/api/src/http/api-response.ts`, while route and schema shapes come from `packages/contracts`.

### Routes

`apps/api/src/app.ts` is the authoritative registration point for the current public HTTP surface.

### Validation

Each route slice parses request data and returns contract-backed payloads before the response leaves the API runtime.

## OpenAPI artifact

The current in-repo OpenAPI artifact is `docs/architecture/spatial-analysis-openapi.yaml`. Treat it as a design/reference artifact that should stay aligned with the shared contracts and route behavior as the spatial-analysis surface evolves.

## How to use this page

- Start here when a change affects request or response shapes.
- Use the artifact pages when you need historic or planning context.
- Use the app and slice docs when you need runtime ownership and implementation context.

:::note Reference Pattern
The authoritative source for exact runtime behavior is still the code in `packages/contracts` and `apps/api`. The OpenAPI YAML is a useful reference artifact, not a substitute for the live contract package.
:::
