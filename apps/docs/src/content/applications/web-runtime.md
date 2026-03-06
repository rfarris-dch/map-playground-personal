---
title: Web Runtime Foundations
description: Entry points, page surfaces, map runtime composition, and shared package dependencies in apps/web.
---

`apps/web` is the repo's interactive frontend. The local README describes it as a "Vue 3 + Tailwind + MapLibre app shell," and the current source keeps that split intact: a thin router, a persistent header shell, one large map composition root, and separate reporting-style table pages.

## Entrypoints and routing

### Application boot

- `apps/web/src/main.ts` creates the Vue app, installs Vue Query, installs the router, loads the global `maplibre-gl` stylesheet, and mounts `App`.
- `apps/web/src/app.vue` is the persistent shell. It reads active route matches, renders the top navigation from `features/navigation/navigation.service.ts`, and hosts the current page with `RouterView`.

### Route surfaces

`apps/web/src/app-router.ts` currently exposes these page surfaces:

- `/map` for the operational map runtime
- `/markets` for the market table surface
- `/providers` for the provider table surface
- `/facilities/hyperscale` and `/facilities/colocation` under the shared `/facilities` route shell

The root route redirects to `/map`, which makes the map page the operational center of the frontend runtime.

## Page surfaces and reading order

### `map-page.vue`

`apps/web/src/pages/map-page.vue` is intentionally thin. It binds the page to `useAppShell()` and passes shell state into two presentational surfaces:

- `features/app/components/map-page-controls.vue` for layer, basemap, measure, and overlay controls
- `features/app/components/map-page-overlays.vue` for selected object detail, quick view, scanner output, and overlay status

That split keeps the route view focused on composition while feature-specific state and lifecycle behavior stay under `features/app`.

### Table and reporting pages

The other top-level pages are not alternate map shells.

- `apps/web/src/pages/markets-page.vue` and `apps/web/src/pages/providers-page.vue` are Vue Query plus TanStack Table screens with infinite loading, sorting, shared `components/ui/*` primitives, and API-backed table fetchers.
- `apps/web/src/pages/facilities-page.vue` is a route shell with tabs that swaps between the hyperscale and colocation child views instead of rebuilding the app shell.

This distinction matters when navigating the codebase: `/map` owns map composition, while the table routes are narrower data surfaces that reuse the same contracts and UI primitives without owning map lifecycle.

## App shell responsibilities

### `use-app-shell.ts`

`apps/web/src/features/app/core/use-app-shell.ts` is the composition root for the map runtime. It assembles smaller shell composables instead of using a global store:

- `use-app-shell-state.ts` owns template refs, map/controller handles, shell-local visibility state, and selected viewport feature caches.
- `use-app-shell-selection.ts` centralizes selected facility and parcel state plus the detail queries that follow those selections.
- `use-app-shell-visibility.ts` keeps basemap, boundary, parcel, facility, and power visibility in sync with the layer runtime.
- `use-app-shell-fiber.ts` manages fiber-specific runtime behavior and map interaction hooks.
- `use-map-overlays.ts` coordinates quick view, scanner, keyboard shortcuts, overlay export, and parcel enrichment flows.
- `use-app-shell-measure-selection.ts` turns raw measure state into exportable analysis summaries.
- `use-app-shell-map-lifecycle.ts` mounts and destroys the map runtime and resets interactions when measure mode takes control.

That gives the web app a clear responsibility split: route components compose, shell composables coordinate, and domain features own their map-specific controllers and services.

## Map runtime plumbing

### Map setup and lifecycle

- `apps/web/src/features/app/lifecycle/app-shell-map.service.ts` creates the `IMap` through `@map-migration/map-engine`, registers the PMTiles protocol, rewrites glyph URLs for the OpenFreeMap basemap, and mounts navigation, scale, and fullscreen controls.
- `apps/web/src/features/app/lifecycle/app-shell-map-lifecycle.service.ts` is the lifecycle coordinator. It initializes the map, creates the shared layer runtime, mounts the basemap controller, and then registers the feature runtimes for boundaries, facilities, parcels, fiber, power, and measure.
- `apps/web/src/features/app/lifecycle/app-shell-map-layer-runtime.service.ts` is the handoff point where those map-facing domain runtimes are mounted and torn down together.

### Layer management and basemap policy

- `apps/web/src/features/layers/layer-runtime.service.ts` applies the catalog rules from `@map-migration/map-layer-catalog`, including dependency checks, zoom windows, default visibility, and stress blocking.
- `apps/web/src/features/basemap/basemap.service.ts` owns the base style URL, satellite imagery insertion, label and landmark grouping, 3D building toggles, and boundary/road visibility groups inside the basemap itself.
- `apps/web/src/features/app/visibility/app-shell-visibility.service.ts` translates app-shell toggles into layer-runtime calls so page components do not manipulate layer IDs directly.

### Shared UI plumbing

Shared UI behavior is split from map lifecycle:

- `apps/web/src/app.vue` and `features/navigation/navigation.service.ts` own top-level application navigation.
- `apps/web/src/components/ui/*` provides reusable shell primitives such as cards, badges, tabs, separators, and data tables that both the map shell and the reporting routes consume.
- The table pages compose those primitives with Vue Query and TanStack Table, while the map page uses feature-scoped components under `features/app/components`.

## API integration boundary

`apps/web` does not build raw fetch calls ad hoc inside route views. The transport boundary is intentionally narrow:

- `apps/web/src/lib/api-client.ts` adds request IDs with `@map-migration/ops`, parses shared error envelopes, and validates JSON through schemas from `@map-migration/contracts`.
- Feature API modules such as `features/facilities/api.ts`, `features/facilities/facility-detail/detail.api.ts`, `features/markets/markets.api.ts`, and `features/providers/providers.api.ts` use route builders and schemas from `@map-migration/contracts`.
- Parcel-specific runtime code in `features/parcels/parcels.service.ts` uses `@map-migration/geo-tiles` to parse the tile publish manifest and keep tile lineage visible to the frontend runtime.

This is the app-shell level contract boundary: the web app owns request timing, selection flow, and coherency handling, while route shapes and validation stay in shared packages.

## Shared package dependencies

The web runtime depends directly on these workspace packages:

| Package | Why it matters to the web runtime |
| --- | --- |
| `@map-migration/contracts` | Defines route builders, request and response schemas, shared error envelopes, and table/detail payload types used across map and reporting pages. |
| `@map-migration/map-engine` | Supplies `IMap`, map creation helpers, MapLibre adapter wiring, PMTiles protocol registration, and control abstractions. |
| `@map-migration/map-layer-catalog` | Defines the authoritative layer IDs, dependency graph, zoom windows, and default visibility rules that the shell runtime enforces. |
| `@map-migration/map-style` | Provides style-layer identity helpers used by facilities, boundaries, parcels, fiber, and power layers to target the correct basemap/style seams. |
| `@map-migration/geo-tiles` | Defines parcel tile manifest parsing and metadata handling so the frontend can reason about tile lineage and coherency. |
| `@map-migration/ops` | Generates request IDs and keeps operational metadata conventions aligned with the rest of the stack. |

## App-shell level boundaries

- Map rendering belongs to `apps/web` plus `@map-migration/map-engine`.
- Shared transport validation belongs to `@map-migration/contracts` and the API runtime, not to route views.
- Layer governance belongs to `@map-migration/map-layer-catalog`, with the shell deciding when user intent should be reconciled against those rules.
- Basemap mutation and style-specific assumptions belong to `features/basemap` plus `@map-migration/map-style`.
- Parcel coherency and tile lineage remain frontend concerns because the shell must reconcile published tiles, viewport stress, and detail responses in one place.

## Related docs

- Use [Repository Architecture](/docs/repository/architecture) for the cross-app boundaries this runtime sits inside.
- Use [Web Feature Domains](/docs/applications/web-feature-domains) when you need per-feature module ownership rather than shell composition.
- Use [Core Runtime Packages](/docs/packages/core-runtime) for the shared package seams this app depends on.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when a web change depends on shared transport schemas.
