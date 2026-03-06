---
title: Ops
description: Shared operational helpers for request IDs and diagnostic-event metadata across the API, web, and pipeline monitor runtimes.
sources:
  - packages/ops/package.json
  - packages/ops/src/index.ts
  - packages/ops/src/index.types.ts
  - apps/api/src/app.ts
  - apps/api/src/http/api-response.ts
  - apps/web/src/lib/api-client.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts
---

`packages/ops` is the smallest runtime package in the monorepo, but it crosses the most app boundaries. It keeps request-ID generation and diagnostic-event structure consistent so API responses, browser requests, and operator tooling can correlate activity using the same conventions.

## Purpose and package boundary

- `packages/ops/src/index.ts` exports the two runtime helpers: `createRequestId()` and `createDiagnosticEvent()`.
- `packages/ops/src/index.types.ts` defines the shared `DiagnosticEvent`, `DiagnosticSeverity`, and `DiagnosticSourceMode` types.
- The package intentionally stays generic. It does not know about Hono, fetch wrappers, or sync dashboards directly.

This is shared operational metadata, not a business-domain package.

## Key exported responsibilities

### Request ID creation

`createRequestId(prefix = "req")` builds IDs from a caller-controlled prefix, a base-36 timestamp, and a random suffix. The package keeps the formatting rule in one place so runtime surfaces do not invent competing request-ID shapes.

Current prefixes show how each surface brands its own requests:

- `api` in `apps/api/src/app.ts`
- `web` by default in `apps/web/src/lib/api-client.ts`
- `pipeline-ui` in `apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts`

### Diagnostic-event creation

`createDiagnosticEvent()` adds:

- a generated request ID
- an ISO timestamp
- `sourceMode`
- `code`
- `message`
- `severity`

That is the repo's shared shape for lightweight operational events when a caller needs structured diagnostics without creating a larger domain-specific schema.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/api/src/app.ts` | Generates request IDs for inbound API requests when the caller did not send a usable one. |
| `apps/api/src/http/api-response.ts` | Reuses the same request-ID convention while building success and error envelopes. |
| `apps/web/src/lib/api-client.ts` | Stamps outbound browser requests with `x-request-id` values before calling the API. |
| `apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts` | Tags status-poll requests so the operator client participates in the same request-ID flow. |

The package currently has no package-local consumer for `createDiagnosticEvent()`, which makes it a ready shared helper for future runbook-oriented or sync diagnostics without forcing each app to define its own event envelope first.

## Operational-helper role in this repo

- `ops` owns generic request and event metadata.
- `contracts` owns public transport headers and response-envelope schemas.
- app runtimes own where those IDs appear, how they are propagated, and what they mean in context.

That split avoids duplicating request-ID logic across three separate app surfaces while keeping transport-specific rules in `packages/contracts`.

## Tests and build behavior

`packages/ops/package.json` defines the standard build, typecheck, lint, and watch scripts, but its test command is still a placeholder:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `echo 'ops tests not implemented yet'`

That means compile-time correctness and integration usage are the current quality gates for this package. There is no package-local runtime test coverage yet for request-ID format or diagnostic-event creation.

## Related docs

- Use [API Runtime Foundations](/docs/applications/api-runtime) for the Hono middleware and envelope helpers that consume request IDs.
- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the frontend fetch layer that emits the same header.
- Use [Pipeline Monitor](/docs/applications/pipeline-monitor) for the polling client that also depends on this helper.
- Use [Contracts](/docs/packages/contracts) for the `ApiHeaders.requestId` contract that this package helps populate.
