---
title: Map Style
description: Shared base-style helpers, catalog-to-style-layer lookup functions, and ordering invariants that keep map feature runtimes aligned.
---

`packages/map-style` is the style contract layer above the catalog and engine packages. It knows how repo-level layer concepts map onto concrete style-layer IDs and which ordering relationships the runtime must preserve when multiple overlays share the same basemap.

## Purpose and package boundary

- `packages/map-style/src/index.types.ts` defines the style-facing type aliases and the catalog-layer subsets used by the helpers.
- `packages/map-style/src/style-layer-ids.ts` maps catalog IDs to the style-layer IDs that feature runtimes should target.
- `packages/map-style/src/manifests/layer-order.ts` declares the invariant ordering rules the frontend should preserve.
- `packages/map-style/src/index.ts` re-exports those helpers and defines the shared `createBaseStyle()` and `validateLayerOrder()` entrypoints.

The package does not mount layers itself. It defines the shared style identity rules that feature runtimes consume.

## Key exported responsibilities

### Base style creation

`createBaseStyle()` returns a minimal version-8 style document with the repo's background layer and naming convention. It is the shared starting point for code that needs a style document shape without duplicating base-style boilerplate.

### Catalog-to-style-layer mapping

`style-layer-ids.ts` turns catalog layer IDs into the real style-layer IDs used by the runtime:

- boundaries map to `{fillLayerId, outlineLayerId}`
- facilities map to cluster, cluster-count, and point layers
- parcels map to fill and outline layers
- power layers map to the specific line/circle/fill combinations the runtime mounts

The aggregate helpers in `index.ts` such as `getBoundaryStyleLayerIds()`, `getFacilitiesStyleLayerIds()`, `getParcelsStyleLayerIds()`, `getPowerStyleLayerIds()`, and `getCatalogStyleLayerIds()` are what feature code should call instead of hard-coding strings repeatedly.

### Layer ordering invariants

`LAYER_ORDER_INVARIANTS` and `validateLayerOrder()` enforce style-level expectations such as:

- choropleth layers must sit below facility points
- parcel outlines must sit above the friction layer
- model overlays must stay below facility points

That gives the repo one place to describe stacking rules that otherwise drift across feature modules.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/web/src/features/facilities/facilities.layer.ts` | Uses `getFacilitiesStyleLayerIds()` to create consistent cluster, count, and point layer IDs for the two facilities perspectives. |
| `apps/web/src/features/boundaries/boundaries.layer.ts` | Uses `getBoundaryStyleLayerIds()` so fill and outline layer naming stays consistent. |
| `apps/web/src/features/parcels/parcels.layer.ts` | Uses parcel style-layer helpers instead of maintaining duplicate layer-ID conventions in the feature. |
| `apps/web/src/features/power/power.layer.ts` | Uses `getPowerStyleLayerIds()` to toggle the multi-layer power overlays coherently. |
| `apps/web/src/features/fiber-locator/fiber-locator.layer.ts` | Uses facilities style-layer IDs as anchor layers so fiber render layers insert in the correct relative position. |

## Style boundary relative to other packages

- `map-layer-catalog` owns catalog IDs and default visibility policy.
- `map-style` owns the mapping from those catalog concepts into concrete style-layer identifiers and ordering rules.
- `map-engine` owns the engine-level style document and map operations that eventually apply those IDs.

This separation keeps the web app from blending visibility policy, style-layer naming, and MapLibre mechanics into one place.

## Tests and build behavior

`packages/map-style/package.json` currently defines:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `echo 'map-style tests not implemented yet'`

Like `map-engine`, this package currently has no package-local runtime tests. The main quality signal today is compile-time safety plus integration usage from the web feature runtimes.

## Related docs

- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the shell-level map plumbing that consumes these helpers.
- Use [Web Feature Domains](/docs/applications/web-feature-domains) for the domain runtimes that apply these style-layer IDs directly.
- Use [Map Layer Catalog](/docs/packages/map-layer-catalog) for the lower-level layer identity and visibility policy this package builds on.
- Use [Map Engine](/docs/packages/map-engine) for the engine-level style types this package reuses.
