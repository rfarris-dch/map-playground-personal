---
title: Web Feature Domains
description: Reading guide for the feature modules under apps/web/src/features, grouped by shell orchestration, map data domains, and reporting or analysis surfaces.
sources:
  - apps/docs/src/content/applications/web-feature-domains.md
  - apps/web/src/features/app/core/use-app-shell.ts
  - apps/web/src/pages/map-page.vue
  - apps/web/src/pages/markets-page.vue
  - apps/web/src/pages/providers-page.vue
  - apps/web/src/pages/facilities-page.vue
---

The feature tree under `apps/web/src/features` is broad, but the runtime split is stable once you read it from the route surfaces inward:

1. `map-page.vue` composes the map shell and delegates nearly all stateful work to `features/app`.
2. The map shell then mounts the map-data domains for boundaries, facilities, fiber, parcels, and power.
3. The reporting routes reuse the same contracts and some shared helpers, but they do not own map lifecycle.

## Domain reading path

| Docs page | What it covers | Feature paths |
| --- | --- | --- |
| [Web Runtime Foundations](/docs/applications/web-runtime) | Entrypoints, router surfaces, app shell, and shared package seams. | `src/main.ts`, `app.vue`, `pages/*` |
| [Web Map Shell Domains](/docs/applications/web-map-shell-domains) | The composition root, visibility and lifecycle composables, basemap policy, navigation, and layer governance. | `features/app`, `features/navigation`, `features/layers`, `features/basemap` |
| [Web Map Data Domains](/docs/applications/web-map-data-domains) | The map-facing domain modules that fetch data, mount layers, manage hover or selection, and feed overlays. | `features/boundaries`, `features/facilities`, `features/fiber-locator`, `features/parcels`, `features/power` |
| [Web Reporting And Analysis Domains](/docs/applications/web-reporting-and-analysis-domains) | Table routes, shared infinite-scroll support, measure selection analytics, quick view, scanner, and spatial-analysis helpers. | `features/markets`, `features/providers`, `features/measure`, `features/quick-view`, `features/scanner`, `features/spatial-analysis`, `features/table` |

## Feature inventory by responsibility

### Shell and map-control domains

| Feature path | Current boundary |
| --- | --- |
| `features/app` | Composition-root orchestration for the `/map` runtime, including state, selection, overlays, visibility, and lifecycle wiring. |
| `features/navigation` | Top navigation items for `app.vue` plus the facilities tab model used by the nested facilities route. |
| `features/layers` | Catalog-driven runtime that reconciles user visibility, zoom windows, and dependency rules from `@map-migration/map-layer-catalog`. |
| `features/basemap` | Base style URL selection, satellite insertion, landmark grouping, road and boundary basemap toggles, and 3D building visibility. |

### Map data and rendering domains

| Feature path | Current boundary |
| --- | --- |
| `features/boundaries` | Boundary fetch, facet filtering, hover state, and map-layer replacement for country, state, and county power overlays. |
| `features/facilities` | Viewport fetch, clustering, hover and selection, facility detail lookups, and table fetchers for hyperscale and colocation routes. |
| `features/fiber-locator` | Fiber catalog fetch, in-view source-layer discovery, tile-layer mounting, and line hover state. |
| `features/parcels` | PMTiles manifest loading, guardrail evaluation, parcel layer mounting, selection, and detail lookup. |
| `features/power` | Open Infrastructure Map source wiring, transmission or substation or plant visibility, and hover detail extraction. |

### Reporting and analysis domains

| Feature path | Current boundary |
| --- | --- |
| `features/markets` | API fetch layer for the `/markets` TanStack Table route. |
| `features/providers` | API fetch layer for the `/providers` TanStack Table route. |
| `features/measure` | Map drawing runtime plus post-selection facility and parcel analysis summaries. |
| `features/quick-view` | Screen-space card placement for facility summaries layered on top of scanner results. |
| `features/scanner` | Aggregation and CSV export helpers for overlay-driven facility and parcel summaries. |
| `features/spatial-analysis` | Shared parcel and facility normalization helpers used by scanner and measure workflows. |
| `features/table` | Shared intersection-observer utility for the reporting screens' infinite-load behavior. |

## Boundary rules that hold across the feature tree

### Services, layers, composables, and route pages

- `*.service.ts` files usually own deterministic transformations, normalization, or small orchestration steps that can be reused without tying directly to Vue templates.
- `*.layer.ts` files own map attachment. They add sources and style layers, listen to map events, manage feature state, and expose small controllers back to the shell.
- Vue composables under `features/app/*/use-*.ts` coordinate cross-feature state for the `/map` route. They translate shell intent into calls against the layer controllers and feature services.
- Route pages stay thin. `map-page.vue` composes the shell, while `markets-page.vue`, `providers-page.vue`, and the `facilities/*` pages compose reporting UIs around feature APIs and shared table primitives.

### Why the docs are split this way

The old single-page inventory made every feature look equivalent, but the runtime is not flat:

- Shell modules decide when features mount and how user intent is reconciled.
- Map data domains own fetch, rendering, and hover or selection behavior for specific data sets.
- Reporting and analysis modules either power table routes or derive summaries from shell-owned selections.

That split is the most reliable way to decide where a change belongs.

## Common cross-links

- Use [Web Runtime Foundations](/docs/applications/web-runtime) before editing feature modules that may affect routing, app boot, or shared package seams.
- Use [Core Runtime Packages](/docs/packages/core-runtime) for `contracts`, `map-engine`, `map-layer-catalog`, and `map-style`.
- Use [Data And Operations Packages](/docs/packages/data-and-operations) when a feature change depends on `geo-tiles` or `ops`.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when a feature change depends on shared request or response schemas.
