---
title: Core Runtime Packages
description: Contracts, map engine, layer catalog, and style packages that define the main app-facing seams.
---

These packages define the shared runtime contracts that the apps depend on most directly.

## Package map

| Package | Purpose | Concrete surfaces |
| --- | --- | --- |
| `packages/contracts` | Shared transport schemas and route helpers. | Analysis, API, boundaries, facilities, fiber locator, parcels, shared, and table contracts are exported from `src/index.ts`. |
| `packages/map-engine` | Engine abstraction over MapLibre. | `IMap`, map creation helpers, PMTiles protocol registration, control helpers, pointer/click event types. |
| `packages/map-layer-catalog` | Runtime-governed layer inventory. | `LAYER_IDS`, `DEFAULT_LAYER_CATALOG`, `isLayerId`, `validateLayerCatalog`, `visibleLayerCount`. |
| `packages/map-style` | Shared style defaults and layer ordering rules. | `createBaseStyle`, style-layer ID readers, layer-order validation. |

## Contracts

`packages/contracts/src/index.ts` re-exports the repo’s shared request and response schemas. This is the transport seam reused by API and web and the correct place for envelope or route-shape changes.

## Map engine

`packages/map-engine/src/index.ts` is the real engine boundary. `MapLibreEngine` implements `IMap` and hides many direct MapLibre calls behind a stable interface. That keeps the web runtime from spreading raw engine semantics into every feature.

## Layer catalog

`packages/map-layer-catalog/src/index.ts` is the governance surface for visible layer IDs and layer budget weighting. The current catalog includes:

- boundaries: county, state, country
- facilities: colocation, hyperscale
- infrastructure: power and fiber layers
- parcels: `property.parcels`

## Style package

`packages/map-style/src/index.ts` handles style-layer identity and ordering rules. It is the right place for shared style contracts, not the app shell.

## Current consumers

- `apps/web` consumes all four of these packages directly.
- `apps/api` depends most heavily on `contracts`.
- The docs app documents them but does not import product runtime code from them.
