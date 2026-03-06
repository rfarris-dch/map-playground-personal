---
title: Web Runtime Foundations
description: Entry points, page surfaces, map runtime composition, and shared package dependencies in apps/web.
---

`apps/web` is a Vue 3 + Vite application with a small router and a large composition-root map runtime.

## Entrypoints and routing

### Application boot

- `apps/web/src/main.ts` creates the Vue app, installs Vue Query, installs the router, and mounts `App`.
- `apps/web/src/app.vue` renders the top navigation chrome and the current route via `RouterView`.

### Route surfaces

`apps/web/src/app-router.ts` currently exposes these page surfaces:

- `/map`
- `/markets`
- `/providers`
- `/facilities/hyperscale`
- `/facilities/colocation`

The root route redirects to `/map`, which makes the map page the operational center of the frontend runtime.

## App shell responsibilities

### `map-page.vue`

`apps/web/src/pages/map-page.vue` is intentionally thin. It binds the page to `useAppShell()` and passes state into presentational control and overlay components.

### `use-app-shell.ts`

`apps/web/src/features/app/use-app-shell.ts` is the composition root for the map runtime. It owns:

- the `IMap` instance
- hover and selection state
- layer and basemap visibility
- parcel and facility detail queries
- measure selection orchestration
- overlay visibility and quick-view/scanner coordination

The page surface stays readable because that orchestration is pushed down into focused app-shell sub-composables and services.

## Map runtime plumbing

### Map setup

`apps/web/src/features/app/app-shell.map.service.ts` initializes the map through `@map-migration/map-engine`, registers the PMTiles protocol, mounts controls, and wires the basemap visibility controller.

### Visibility runtime

`apps/web/src/features/layers/layer-runtime.service.ts` applies the layer catalog rules from `@map-migration/map-layer-catalog`, including dependency checks, zoom windows, and stress blocking.

### Basemap behavior

`apps/web/src/features/basemap/basemap.service.ts` owns the base style URL, satellite insertion logic, label and landmark grouping, and 3D building handling.

## Shared package dependencies

The web runtime depends directly on these workspace packages:

| Package | Why it matters to the app shell |
| --- | --- |
| `@map-migration/contracts` | Shared API routes, schemas, response types, and parse helpers. |
| `@map-migration/map-engine` | The `IMap` abstraction and MapLibre adapter layer. |
| `@map-migration/map-layer-catalog` | Layer IDs, dependency rules, default visibility, and budget weighting. |
| `@map-migration/map-style` | Style-layer ordering and style ID helpers. |
| `@map-migration/geo-tiles` | Tile manifest semantics and parcel tile metadata helpers. |
| `@map-migration/ops` | Request ID and operational helper reuse across the stack. |

## App-shell level boundaries

- Map rendering belongs to the web app plus `map-engine`.
- Transport validation belongs to `contracts` and the API.
- Layer governance belongs to `map-layer-catalog`.
- Basemap mutation and style-specific assumptions belong to `basemap.service.ts` and `map-style`.
- Parcel coherency and tile lineage are app-shell concerns because the frontend must reconcile tile manifests with detail responses.
