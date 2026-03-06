---
title: Core Runtime Packages
description: Contracts, map engine, layer catalog, and style packages that define the main app-facing seams.
---

These packages define the shared runtime contracts that the apps depend on most directly. Treat this page as the overview and use the package-specific pages for the authoritative breakdown of exports, consumers, and test/build behavior.

## Package map

| Package | Purpose | Concrete surfaces |
| --- | --- | --- |
| [`packages/contracts`](/docs/packages/contracts) | Shared transport schemas and route helpers. | Analysis, API, boundaries, facilities, fiber locator, parcels, shared, and table contracts are re-exported from `src/index.ts`. |
| [`packages/map-engine`](/docs/packages/map-engine) | Engine abstraction over MapLibre. | `IMap`, `MapLibreEngine`, map creation helpers, PMTiles protocol registration, zoom helpers, and control factories. |
| [`packages/map-layer-catalog`](/docs/packages/map-layer-catalog) | Runtime-governed layer inventory. | `LAYER_IDS`, `DEFAULT_LAYER_CATALOG`, `isLayerId`, `validateLayerCatalog`, and `visibleLayerCount`. |
| [`packages/map-style`](/docs/packages/map-style) | Shared style defaults and layer ordering rules. | `createBaseStyle`, style-layer ID readers, and layer-order validation. |

## How these packages fit together

- [`Contracts`](/docs/packages/contracts) is the transport boundary between the API, the web frontend, the pipeline monitor, and query packages such as `geo-sql`.
- [`Map Engine`](/docs/packages/map-engine) is the low-level browser map boundary. The web shell uses it so feature code can depend on `IMap` instead of raw `maplibre-gl` objects.
- [`Map Layer Catalog`](/docs/packages/map-layer-catalog) defines the canonical runtime layer IDs, dependency graph, zoom windows, and default visibility policy.
- [`Map Style`](/docs/packages/map-style) turns catalog-layer intent into style-layer IDs and ordering invariants that individual feature runtimes can apply without hard-coding those relationships repeatedly.

## Reading path

1. Start with [Web Runtime Foundations](/docs/applications/web-runtime) to see where these packages sit in the frontend shell.
2. Read [Contracts](/docs/packages/contracts) when a change affects route shapes, envelopes, or shared types.
3. Read [Map Engine](/docs/packages/map-engine), [Map Layer Catalog](/docs/packages/map-layer-catalog), and [Map Style](/docs/packages/map-style) when a change affects map lifecycle, layer governance, or style-layer targeting.
4. Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) for the reference-oriented view of the same transport seams.

## Current consumers

- `apps/web` consumes all four of these packages directly.
- `apps/api` depends most heavily on [`contracts`](/docs/packages/contracts).
- `apps/pipeline-monitor` depends on [`contracts`](/docs/packages/contracts) for parcel sync status transport shapes.
- `packages/map-style` depends on [`map-engine`](/docs/packages/map-engine) and [`map-layer-catalog`](/docs/packages/map-layer-catalog), but those lower-level packages do not depend back on style logic.
- The docs app documents these seams but does not import product runtime code from them.
