---
title: Source Reference Patterns
description: The docs-to-source linking model used in this docs app to keep explanations anchored to real files.
sources:
  - packages/contracts/src/index.ts
  - packages/contracts/src/api-contracts.ts
  - apps/api/src/app.ts
  - apps/web/src/features/app/use-app-shell.ts
  - scripts/refresh-parcels.sh
  - docs/architecture/spatial-analysis-openapi.yaml
---

This docs app uses a simple rule: every major page should name the real source files that define the behavior it explains, and the page shell should surface those references without forcing the reader to search the repo manually.

## Authoritative vs explanatory content

| Content type | What it is | Where it lives |
| --- | --- | --- |
| Authoritative runtime source | Executable code, schemas, scripts, or operational artifacts. | `apps/*`, `packages/*`, `scripts/*`, selected `docs/*` artifacts. |
| Explanatory docs | Human-readable summaries, boundaries, and workflow explanations. | `apps/docs/src/content/*` |

## Reference pattern used here

Each docs page should include:

1. concrete file paths in frontmatter `sources`
2. a sentence on why those files matter
3. internal cross-links to related docs pages
4. a clear distinction between the explanatory page source and the authoritative runtime or artifact sources

This keeps readers from having to search the repo manually when they already know the topic they are on.

## Source-reference matrix

| Concern | Authoritative source paths | Companion docs route | Why this pattern exists |
| --- | --- | --- | --- |
| Shared transport contracts | `packages/contracts/src/index.ts`, `packages/contracts/src/api-contracts.ts`, `packages/contracts/src/shared-contracts.ts` | [`/docs/packages/contracts`](/docs/packages/contracts), [`/docs/references/contracts-and-api-surfaces`](/docs/references/contracts-and-api-surfaces) | Route builders, envelopes, and schema modules need one source of truth reused by API, web, and pipeline runtimes. |
| HTTP route registration | `apps/api/src/app.ts`, `apps/api/src/http/api-response.ts`, `apps/api/src/geo/**` | [`/docs/applications/api-runtime`](/docs/applications/api-runtime), [`/docs/applications/api-geo-slices`](/docs/applications/api-geo-slices) | Readers should be able to jump from the foundation docs to the exact registration and route-slice seams. |
| Frontend composition ownership | `apps/web/src/features/app/use-app-shell.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | [`/docs/applications/web-runtime`](/docs/applications/web-runtime), [`/docs/applications/web-feature-domains`](/docs/applications/web-feature-domains) | The web shell and feature-domain pages explain the runtime shape, but the app sources still define the real composition boundary. |
| Operational workflows | `scripts/refresh-parcels.sh`, `scripts/load-parcels-canonical.sh`, `scripts/publish-parcels-manifest.ts`, `scripts/rollback-parcels-manifest.ts` | [`/docs/operations/parcel-and-tile-workflows`](/docs/operations/parcel-and-tile-workflows) | Operators need the exact command wrappers and artifacts, not a generic runbook summary. |
| Existing architecture artifacts | `docs/architecture/spatial-analysis-openapi.yaml`, `docs/architecture/*.qmd`, `docs/research/*`, `docs/review/*`, `docs/runbooks/*` | [`/docs/artifacts/architecture-artifacts`](/docs/artifacts/architecture-artifacts) and the individual artifact routes | Migrated artifacts stay searchable in the docs app without losing the original source document. |

## How the page shell applies the pattern

The Vue docs shell renders a `Source References` panel for every non-home route:

- the page source is shown first so readers can tell whether they are looking at authored docs content or a rendered legacy artifact
- frontmatter `sources` are rendered as authoritative references with related docs links when a companion page already exists
- the docs page stays explanatory even when the authoritative source is also a docs artifact such as `docs/architecture/spatial-analysis-openapi.yaml`

## When to create a dedicated reference page

Create a separate page when:

- a package is used by multiple apps
- an operational workflow spans scripts, API, and UI
- an existing architecture artifact already exists in `docs/*`

## Current reference anchors

- `packages/contracts` for transport schemas
- `apps/api/src/app.ts` for registered HTTP surface
- `apps/web/src/features/app/use-app-shell.ts` for frontend composition ownership
- `scripts/*` for the operational parcel path
- `docs/architecture/*`, `docs/research/*`, `docs/review/*`, and `docs/runbooks/*` for migrated artifacts
