---
title: Map Engine
description: The MapLibre adapter boundary that gives the web runtime a stable `IMap` surface, control factories, and PMTiles protocol wiring.
---

`packages/map-engine` is the browser map runtime boundary. It keeps raw `maplibre-gl` concerns isolated behind `IMap`, typed event payloads, and small factory helpers so the web app can coordinate map lifecycle without importing MapLibre semantics everywhere.

## Purpose and package boundary

- `packages/map-engine/src/index.types.ts` defines the stable map-facing interface: `IMap`, `MapAdapter`, `MapCreateOptions`, event types, source/layer/style aliases, and projection/control option types.
- `packages/map-engine/src/index.ts` contains the concrete `MapLibreEngine` implementation plus the helper factories used by the frontend shell.
- The package is intentionally narrow: it does not know about app feature domains, layer catalogs, or business data. It only owns map runtime mechanics.

## Key exported responsibilities

### Stable map interface

`IMap` is the core seam. It wraps the operations the web runtime actually uses:

- add and remove controls, sources, and layers
- feature-state updates and source-data replacement
- zoom, bounds, style, terrain, and projection operations
- click and pointer event subscriptions normalized into simple typed payloads

This prevents the rest of `apps/web` from depending directly on raw `Map` instances or MapLibre event objects.

### Adapter and map creation

`createMapLibreAdapter()` and `createMap()` build the real browser map. The adapter:

- instantiates `maplibregl.Map`
- applies optional min/max zoom, hash, transform-request, and projection settings
- returns the wrapped `MapLibreEngine` instead of exposing the raw instance

### PMTiles and control helpers

`registerPmtilesProtocol()` reference-counts the `pmtiles://` protocol registration so multiple map consumers can share one protocol runtime safely.

The package also exports small control factories:

- `createNavigationControl()`
- `createScaleControl()`
- `createFullscreenControl()`

Those helpers keep MapLibre-specific control option mapping out of the app shell.

### Small runtime helpers

`isZoomInRange()` is the utility exported alongside the heavier map runtime helpers for zoom-bound checks that need to stay engine-consistent.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/web/src/features/app/lifecycle/app-shell-map.service.ts` | Creates the map, registers PMTiles, rewrites glyph requests, and mounts fullscreen/navigation/scale controls through the engine surface. |
| `apps/web/src/features/layers/layer-runtime.service.ts` | Uses `IMap` instead of raw MapLibre objects so layer governance code can stay engine-agnostic. |
| `apps/web/src/features/facilities/facilities.layer.ts`, `features/parcels/parcels.layer.ts`, `features/measure/measure.layer.ts`, `features/power/power.layer.ts`, and other feature runtimes | Depend on `IMap` plus typed pointer/click events for feature-state, hover, and visibility behavior. |
| `packages/map-style` | Reuses `MapStyleLayer` and `MapStyleSpecification` types so style helpers stay aligned with the same engine-level style document shape. |

## Map engine boundary in practice

- The engine package owns raw MapLibre lifecycle, event adaptation, and PMTiles protocol wiring.
- The web shell owns when maps are created or destroyed, which feature runtimes mount, and how app state reacts to those events.
- Feature modules should depend on `IMap` rather than create new engine abstractions of their own.

## Tests and build behavior

`packages/map-engine/package.json` currently defines:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `echo 'map-engine tests not implemented yet'`

That means the package has compile-time and lint coverage today, but no direct runtime test suite yet. Behavior is currently exercised indirectly through the web app integration path rather than package-local tests.

## Related docs

- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the shell that creates and owns the map runtime.
- Use [Web Feature Domains](/docs/applications/web-feature-domains) when you need the per-feature layer/controller view of the same `IMap` surface.
- Use [Map Style](/docs/packages/map-style) for the package that consumes engine style types to reason about style-layer identity.
