---
title: Web Feature Domains
description: The feature modules under apps/web/src/features and the responsibilities they currently own.
---

The feature tree under `apps/web/src/features` is broad, but it is not random. Most modules fall into one of four categories: app-shell orchestration, map layer domains, overlay tools, and table/reporting surfaces.

## Runtime and shell domains

| Feature path | Responsibility |
| --- | --- |
| `features/app` | Composition-root orchestration, lifecycle wiring, overlays, map setup, and shared shell state. |
| `features/navigation` | Top-level navigation items used by `app.vue`. |
| `features/layers` | Catalog-driven visibility runtime and layer coordination. |
| `features/basemap` | Base style selection and basemap layer visibility groups. |

## Map domain features

| Feature path | Current role |
| --- | --- |
| `features/boundaries` | Boundary visibility, facet selection, and hover state. |
| `features/facilities` | Facility layers, perspective-specific behavior, and facility detail UI. |
| `features/fiber-locator` | Fiber layer visibility, source-layer filtering, and API-backed layer discovery. |
| `features/parcels` | Parcel draw, lookup, enrich/detail integration, and coherency handling. |
| `features/power` | Transmission, substations, plants, and power hover state. |
| `features/providers` | Provider-facing table and map integrations. |
| `features/markets` | Market table/runtime surfaces. |

## Tooling and analysis features

| Feature path | Current role |
| --- | --- |
| `features/measure` | Measure mode, area selection, selection export, and draw controls. |
| `features/quick-view` | Quick object summaries layered on top of map selections. |
| `features/scanner` | Scanner overlays and selection workflows. |
| `features/spatial-analysis` | Analysis-oriented UI and runtime helpers. |
| `features/table` | Shared table behavior used by reporting-style screens. |

## Responsibility boundaries worth preserving

### Services vs layers vs composables

- `*.service.ts` files usually hold pure coordination or transformation logic.
- Layer controllers own map-facing behavior and should not become request orchestration hubs.
- App-shell composables coordinate cross-feature state and keep the route view thin.

### Domain pages should stay digestible

The feature surface is large enough that a single “web app” page is not maintainable. The runtime foundation page explains composition-root behavior. This page explains where to look when work becomes domain specific.

## Common cross-links

- Use [Web Runtime Foundations](/docs/applications/web-runtime) for shared runtime plumbing.
- Use [Core Runtime Packages](/docs/packages/core-runtime) for the catalog, engine, and style package seams.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when a feature change depends on shared payload shapes.
