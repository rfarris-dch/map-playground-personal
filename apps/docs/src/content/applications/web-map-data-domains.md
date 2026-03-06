---
title: Web Map Data Domains
description: The data-specific web features that fetch map data, mount style layers, manage hover and selection, and feed overlays or detail queries.
sources:
  - apps/docs/src/content/applications/web-map-data-domains.md
  - apps/web/src/features/boundaries/boundaries.layer.ts
  - apps/web/src/features/boundaries/boundaries.service.ts
  - apps/web/src/features/facilities/facilities.layer.ts
  - apps/web/src/features/facilities/facilities.service.ts
  - apps/web/src/features/facilities/facility-detail/detail.ts
  - apps/web/src/features/fiber-locator/fiber-locator.layer.ts
  - apps/web/src/features/fiber-locator/api.ts
  - apps/web/src/features/parcels/parcels.layer.ts
  - apps/web/src/features/parcels/parcels.service.ts
  - apps/web/src/features/parcels/parcel-detail/detail.ts
  - apps/web/src/features/power/power.layer.ts
  - apps/web/src/features/power/power-hover.ts
---

The map-data domains all follow roughly the same contract:

- an API or service layer fetches or normalizes data
- a `*.layer.ts` file mounts sources and style layers on the map
- hover or selection helpers translate raw map features into typed UI state
- the app shell owns the final mount and teardown order

That separation matters because these modules are map runtimes first, not page components.

## Boundaries

### What the feature owns

`features/boundaries` controls the country, state, and county overlays shown on the map:

- `api.ts` fetches boundary power data from the shared contracts surface.
- `boundaries.service.ts` owns feature-independent styling logic such as fill color ramps, outline color expressions, heat stops, and layer-ID helpers.
- `boundaries-layer.service.ts` transforms fetched features into facet options, filtered feature sets, hover models, and width stops.
- `boundaries.layer.ts` mounts the actual GeoJSON source plus fill and outline layers, manages feature-state hover, and suppresses the overlapping basemap boundary layers while the custom overlays are active.

### Boundary with the shell

The shell decides whether a boundary level is visible and which region IDs are selected, but the boundaries feature decides how those filters affect rendered features and hover output.

## Facilities

### What the feature owns

`features/facilities` spans both map and reporting use cases:

- `facilities.layer.ts` fetches viewport data, clusters points, mounts the perspective-specific layers, and handles selection or hover state.
- `facilities.service.ts` owns bbox quantization, source-data normalization, feature-ID helpers, and status formatting.
- `hover.ts` translates rendered features into stable hover state for the map overlays.
- `facility-detail/detail.ts` and `detail.api.ts` handle the selected-facility detail query.
- `facilities-table.api.ts` supports the `/facilities/hyperscale` and `/facilities/colocation` table routes.

### Boundary with the shell and routes

- The map shell mounts the hyperscale and colocation layer controllers through the lifecycle services.
- The map shell also owns the currently selected facility and decides when detail queries should run.
- The facilities table pages reuse the same contracts but do not share map lifecycle with the map route.

## Fiber locator

### What the feature owns

`features/fiber-locator` is split between transport, render layers, and hover:

- `api.ts` fetches the catalog and the set of source layers currently visible in the viewport.
- `fiber-locator.service.ts` formats status text and converts catalog responses into shell-friendly source-layer options.
- `fiber-locator.layer.ts` mounts vector-tile sources for metro and longhaul lines, normalizes source-layer names, and rebuilds render layers when the selected source-layer subset changes.
- `hover.ts` translates tile features into a typed hover model and controls feature-state hover.

### Boundary with the shell

The shell-owned `use-app-shell-fiber.ts` decides when to fetch in-view layers, which line families are visible, and which source layers are selected. The feature itself stays focused on rendering and hover behavior.

## Parcels

### What the feature owns

`features/parcels` is the most operationally aware map-data domain:

- `parcels.service.ts` loads the published PMTiles manifest, validates predicted viewport cost, and formats parcel status and guardrail messaging.
- `parcels.layer.ts` validates the manifest against `@map-migration/geo-tiles`, mounts the PMTiles-backed source, enforces guardrail visibility, and manages hover plus selection state.
- `parcel-detail/detail.ts` and related files fetch the selected parcel detail payload.

### Boundary with the shell

- The shell decides whether the parcels layer should be visible.
- The parcels feature decides whether that intent can be honored, based on manifest readiness, predicted tile count, and runtime stress.
- Selected parcels flow back to the shell so overlays and detail panes can remain route-level concerns instead of map-layer concerns.

## Power

### What the feature owns

`features/power` mounts the repo's power overlays on top of the shared basemap:

- `power.layer.ts` wires the Open Infrastructure Map vector source and creates the transmission, substation, and plant style layers.
- `power.service.ts` exposes the shell-facing layer IDs and human-readable metadata.
- `power-hover.ts` interprets rendered power features, extracts voltage or generation values, and controls feature-state hover.

### Boundary with the shell

The shell only decides which power families are visible and when hover should be cleared. The power feature owns how those families map onto source layers and hover metadata.

## Cross-domain rules

### `*.service.ts`

Use services for normalization, formatters, source-data construction, and guardrail logic that should stay testable without a live map instance.

### `*.layer.ts`

Use layer files for:

- `map.addSource()` and `map.addLayer()`
- map event handlers
- feature-state hover or selection
- controller objects returned to the shell

### Detail and hover helpers

Selected-object detail queries and hover translators should stay outside the layer controller where possible. That keeps the layer focused on render state while the shell decides when detail panels are shown.

## Shared package seams

| Package | Map-data dependency |
| --- | --- |
| [`packages/contracts`](/docs/packages/contracts) | Shared route builders and payload schemas for boundaries, facilities, fiber, and parcel detail queries. |
| [`packages/map-style`](/docs/packages/map-style) | Style-layer ID helpers for boundaries, facilities, parcels, and power. |
| [`packages/map-engine`](/docs/packages/map-engine) | The map abstraction all layer controllers depend on. |
| [`packages/geo-tiles`](/docs/packages/geo-tiles) | Parcel manifest assertions and PMTiles dataset metadata. |

## Related docs

- Use [Web Map Shell Domains](/docs/applications/web-map-shell-domains) for the shell code that mounts these controllers.
- Use [Web Reporting And Analysis Domains](/docs/applications/web-reporting-and-analysis-domains) for the table routes and analysis helpers that consume data from these domains.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) and [Troubleshooting And Recovery](/docs/operations/troubleshooting-and-recovery) for the operational parcel flows behind the parcels feature.
