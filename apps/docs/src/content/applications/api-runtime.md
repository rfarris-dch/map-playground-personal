---
title: API Runtime Foundations
description: Hono startup, middleware, runtime config, shared HTTP helpers, and the split between HTTP and sync runtimes.
---

`apps/api` has two runtime entrypoints: the HTTP server in `src/index.ts` and the background sync worker in `src/sync-worker.ts`.

## HTTP runtime

### Process startup

`apps/api/src/index.ts` creates the app through `createApiApp()`, starts the Hono server on `PORT` defaulting to `3001`, and closes the Bun SQL pool on shutdown.

### App construction

`apps/api/src/app.ts` builds the Hono app and owns shared middleware:

- request ID generation and propagation
- request body limits
- request timeout handling
- standardized JSON error handling
- health endpoints
- route registration for boundaries, facilities, fiber locator, parcels, markets, and providers

## Shared HTTP helpers

The `apps/api/src/http` folder holds transport-focused helpers rather than domain logic:

| File | Role |
| --- | --- |
| `api-response.ts` | Shared success/error envelopes, debug detail handling, and request ID helpers. |
| `json-request.service.ts` | JSON request parsing helpers. |
| `pagination-params.service.ts` | Page, page size, max offset, and pagination normalization. |
| `polygon-bbox.service.ts` | AOI parsing helpers. |
| `runtime-config.ts` | Runtime source modes and data-version configuration. |
| `spatial-analysis-policy.service.ts` | Policy helpers for bounded spatial requests. |

## Runtime configuration

`apps/api/src/http/runtime-config.ts` reads source-mode env vars and enforces the current production-path constraint: this API build expects PostGIS-backed serving modes for boundaries, facilities, and parcels.

## Database wiring

`apps/api/src/db/postgres.ts` uses Bun SQL and retries on connection-closed failures. It intentionally stays minimal:

- resolve connection string
- execute parameterized SQL
- close the shared pool during shutdown

## Background worker runtime

`apps/api/src/sync-worker.ts` starts long-running hyperscale and parcels sync loops in parallel. The worker is separate from the HTTP runtime so background jobs do not have to be coupled to request handling.

## Current architectural split

- HTTP runtime: request/response work, transport policy, route registration.
- Background runtime: long-running sync orchestration and parcel/hyperscale lifecycle management.
- Shared dependencies: Bun SQL pool, contracts, and ops helpers.
