---
title: Web Reporting And Analysis Domains
description: Table-route features, shared infinite-scroll support, and the analysis helpers that turn map selections into quick-view, scanner, and measure outputs.
sources:
  - apps/docs/src/content/applications/web-reporting-and-analysis-domains.md
  - apps/web/src/pages/markets-page.vue
  - apps/web/src/pages/providers-page.vue
  - apps/web/src/pages/facilities-hyperscale-page.vue
  - apps/web/src/pages/facilities-colocation-page.vue
  - apps/web/src/features/markets/markets.api.ts
  - apps/web/src/features/providers/providers.api.ts
  - apps/web/src/features/table/use-infinite-scroll.ts
  - apps/web/src/features/measure/measure.layer.ts
  - apps/web/src/features/measure/measure-analysis.service.ts
  - apps/web/src/features/quick-view/quick-view.service.ts
  - apps/web/src/features/scanner/scanner.service.ts
  - apps/web/src/features/spatial-analysis/spatial-analysis-parcels-query.service.ts
  - apps/web/src/features/spatial-analysis/spatial-analysis-parcels.service.ts
  - apps/web/src/features/spatial-analysis/spatial-analysis-facilities.service.ts
---

These features either power non-map reporting routes or derive analysis artifacts from state that the map shell already owns. They are downstream consumers of contracts and selections more often than they are lifecycle owners.

## Table-backed reporting routes

### Markets and providers

The `/markets` and `/providers` routes follow the same structure:

- route pages own the TanStack Table setup, summary cards, sorting state, and Vue Query pagination loop
- `features/markets/markets.api.ts` and `features/providers/providers.api.ts` contain the transport-specific fetchers
- `features/table/use-infinite-scroll.ts` provides the shared intersection-observer behavior that loads more rows when the sentinel enters view

That means table page behavior should normally change in the route SFCs, while request semantics belong in the feature API files and scroll behavior belongs in `features/table`.

### Facilities tables

The two facilities reporting routes live under the shared `/facilities` route shell:

- `facilities-page.vue` owns the nested tab layout and route switching
- `facilities-hyperscale-page.vue` and `facilities-colocation-page.vue` own their own sorting models, summary cards, and Vue Query pagination state
- `features/facilities/facilities-table.api.ts` is the transport seam they share

The facilities feature therefore crosses both map-data and reporting boundaries. Map rendering stays in `facilities.layer.ts`, while tabular browsing stays in the route pages plus the table API.

## Measure workflow

`features/measure` is the bridge between direct map interaction and structured analysis:

- `measure.layer.ts` owns the interactive drawing runtime for distance or area selection, including freeform-close behavior, rectangle and circle completion, and overlay source updates.
- `measure.service.ts` converts the raw runtime state into display-ready geometry, distances, and areas.
- `measure-analysis.api.ts` calls the shared selection endpoints for facilities and parcels.
- `measure-analysis.service.ts` filters facility points against the selected polygon, summarizes provider and perspective totals, and exports CSV-ready output.

The shell decides when measure mode is active. The measure feature decides how drawn geometry becomes analyzable data.

## Quick view and scanner overlays

These overlays are built from feature data the shell already holds:

- `scanner.service.ts` converts visible facilities and selected parcels into perspective summaries, top-provider rollups, and CSV export text.
- `quick-view.service.ts` takes the scanner facility set and places summary cards around the viewport while avoiding overlap and screen-edge collisions.
- The shell-side overlay composables decide when quick view or scanner are allowed to run, but the feature services decide how those results are calculated.

This is why `quick-view` and `scanner` are feature services, not route components or map layers.

## Spatial-analysis helpers

`features/spatial-analysis` provides shared normalization helpers that support both measure and scanner workflows:

- `spatial-analysis-parcels-query.service.ts` paginates parcel-enrich responses, deduplicates parcels by ID, carries warnings forward, and detects ingestion-run mismatches across pages.
- `spatial-analysis-parcels.service.ts` formats parcel field access and focus-field output for downstream summaries.
- `spatial-analysis-facilities.service.ts` normalizes facility comparison and display labels.
- `spatial-analysis-overview.service.ts` builds parcel-level summary output used by analysis-oriented overlays.

These files are the right place for cross-feature analysis rules that should not live inside the map shell or a single overlay.

## Responsibility boundaries worth preserving

### Route pages vs feature APIs

- Route pages own table columns, summary-card composition, and sorting state.
- Feature API files own request construction and contract parsing.
- Shared scroll behavior belongs in `features/table`, not copied into each route page.

### Map overlays vs analysis helpers

- Shell composables decide when quick view or scanner are active and what data is available.
- `scanner.service.ts`, `quick-view.service.ts`, and `measure-analysis.service.ts` decide how to transform that data into summaries, placements, and export payloads.
- `spatial-analysis/*` should stay as shared math and normalization helpers rather than taking on route or overlay state.

## Shared package seams

| Package | Reporting or analysis dependency |
| --- | --- |
| [`packages/contracts`](/docs/packages/contracts) | Table payloads, sort enums, facility or parcel selection endpoints, warnings, and pagination metadata. |
| [`packages/ops`](/docs/packages/ops) | Shared request metadata through the frontend API client. |
| [`packages/geo-tiles`](/docs/packages/geo-tiles) | Indirectly relevant when parcel analysis must stay aligned with the published parcel ingestion run. |

## Related docs

- Use [Web Map Shell Domains](/docs/applications/web-map-shell-domains) for the shell composables that feed measure, quick view, and scanner state.
- Use [Web Map Data Domains](/docs/applications/web-map-data-domains) for the facilities and parcels data sources that these analysis flows consume.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when a reporting or analysis change depends on shared table or selection schemas.
