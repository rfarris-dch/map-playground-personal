---
title: Web Map Shell Domains
description: The shell-focused feature modules that keep the /map route thin while coordinating lifecycle, visibility, basemap policy, overlays, and navigation.
sources:
  - apps/docs/src/content/applications/web-map-shell-domains.md
  - apps/web/src/pages/map-page.vue
  - apps/web/src/features/app/core/use-app-shell.ts
  - apps/web/src/features/app/core/use-app-shell-state.ts
  - apps/web/src/features/app/visibility/use-app-shell-visibility.ts
  - apps/web/src/features/app/fiber/use-app-shell-fiber.ts
  - apps/web/src/features/app/overlays/use-map-overlays.ts
  - apps/web/src/features/app/lifecycle/use-app-shell-map-lifecycle.ts
  - apps/web/src/features/layers/layer-runtime.service.ts
  - apps/web/src/features/basemap/basemap.service.ts
  - apps/web/src/features/navigation/navigation.service.ts
---

`apps/web/src/features/app` is the real composition root for the map runtime. `map-page.vue` mostly forwards refs, state, and callbacks between two presentational components, while `useAppShell()` assembles the feature-specific controllers that make the map work.

## Page-level integration points

### `map-page.vue`

The `/map` route keeps a strict split between controls and overlays:

- `features/app/components/map-page-controls.vue` renders the layer, basemap, measure, fiber, and overlay toggles.
- `features/app/components/map-page-overlays.vue` renders hover cards, detail drawers, quick view cards, scanner output, and overlay status.
- `useAppShell()` supplies both surfaces with state and action functions instead of letting the route mutate layer controllers directly.

That keeps the route component focused on composition rather than runtime policy.

## `features/app`: orchestration by composable and service

### Core state and status

- `core/use-app-shell-state.ts` owns the long-lived refs: the map instance, controller handles, visible feature caches, shell panel state, and shared selection state used across the map route.
- `core/use-app-shell-status.ts` derives user-facing status text from facilities and parcel runtime state.
- `core/app-shell.constants.ts` centralizes the layer IDs that bridge shell visibility with the shared catalog and feature runtimes.

### Selection and overlay orchestration

- `selection/use-app-shell-selection.ts` is the shell seam for selected facilities and parcels. It coordinates feature controllers with the facility-detail and parcel-detail queries rather than doing that work inside overlay components.
- `overlays/use-map-overlays.ts` combines three smaller concerns:
  - `use-map-overlays-shortcuts.ts` owns keyboard toggles and overlay state.
  - `use-map-overlays-scanner-parcels.ts` drives parcel enrichment for the scanner flow.
  - `use-map-overlays-display.ts` turns shell state into quick-view and scanner display models.
- `measure-selection/use-app-shell-measure-selection.ts` and `measure-selection/measure-selection.service.ts` transform finished measure geometry into exportable facility and parcel summaries.

### Visibility and lifecycle

- `visibility/use-app-shell-visibility.ts` is the narrow shell API for turning UI toggles into catalog visibility, basemap visibility, and selection reset behavior.
- `lifecycle/use-app-shell-map-lifecycle.ts` mounts the runtime on component mount, tears it down on unmount, and resets map interactions when measure mode takes over.
- The lifecycle services under `features/app/lifecycle` are responsible for boot order: create the map, create the shared layer runtime, mount basemap behavior, then register the feature controllers for boundaries, facilities, parcels, fiber, power, and measure.

## `features/layers`: catalog governance instead of ad hoc visibility

`features/layers/layer-runtime.service.ts` is the enforcement layer between shell intent and map rendering:

- It reads default visibility from `@map-migration/map-layer-catalog`.
- It resolves dependency chains and zoom windows before exposing effective visibility.
- It tracks stress blocking separately from user intent, which is why parcel guardrails can hide a layer without losing the user's preferred toggle state.
- It exposes registration hooks so individual feature controllers only need to implement `setVisible()`.

This is the place to change cross-domain visibility policy. Feature layers should not each reinvent dependency logic.

## `features/basemap`: style mutation and base-layer policy

`features/basemap/basemap.service.ts` owns everything that mutates the underlying basemap style:

- picks the default style URL
- injects the satellite raster source and layer
- groups landmarks, roads, boundaries, labels, and 3D buildings into shell-facing toggles
- exposes a `mountBasemapLayerVisibility()` controller so the shell can treat basemap groups like any other visibility surface

That is why basemap changes belong here plus `@map-migration/map-style`, not inside domain layers such as facilities or parcels.

## `features/navigation`: route metadata only

`features/navigation/navigation.service.ts` is intentionally small:

- `appNavigationItems` defines the four top-level app routes rendered by `app.vue`
- `facilityNavigationItems` defines the nested facilities tabs rendered by `facilities-page.vue`

There is no router logic here beyond labels and route metadata. The feature exists so shell components do not hardcode nav labels.

## Responsibility boundaries worth preserving

### Services vs composables vs components

- Services under `features/app/*/*.service.ts` should keep logic deterministic and UI-agnostic.
- Composables under `features/app/*/use-*.ts` own Vue refs, watchers, and lifecycle hooks.
- Components under `features/app/components` should stay presentational. They receive typed props and emit user intent back to `useAppShell()`.

### Shell code vs domain code

- Shell code decides when a domain runtime is mounted, reset, or hidden.
- Domain features decide how a specific dataset is fetched, rendered, hovered, or selected.
- The route page should not bypass the shell to call domain controllers directly.

## Shared package seams

| Package | Shell-domain dependency |
| --- | --- |
| [`packages/map-engine`](/docs/packages/map-engine) | Creates the map instance, exposes the `IMap` abstraction, and hosts control mounting plus PMTiles protocol setup. |
| [`packages/map-layer-catalog`](/docs/packages/map-layer-catalog) | Defines authoritative layer IDs, dependency graphs, and zoom windows for `layer-runtime.service.ts`. |
| [`packages/map-style`](/docs/packages/map-style) | Supplies basemap and feature style-layer IDs so shell code can mount or hide the correct layers. |
| [`packages/contracts`](/docs/packages/contracts) | Provides shared enums and request types that shell-owned feature flows such as fiber or measure selection depend on. |
| [`packages/ops`](/docs/packages/ops) | Supplies request metadata helpers used by the frontend transport boundary. |

## Related docs

- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the route and boot-level context around this shell.
- Use [Web Map Data Domains](/docs/applications/web-map-data-domains) for the domain layers this shell mounts.
- Use [Web Reporting And Analysis Domains](/docs/applications/web-reporting-and-analysis-domains) for the overlay analytics and reporting helpers that consume shell-owned state.
