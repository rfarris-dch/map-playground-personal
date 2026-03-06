---
title: Map Layer Catalog
description: The authoritative layer ID catalog, default visibility policy, zoom windows, and dependency rules enforced by the web shell.
---

`packages/map-layer-catalog` is the governance layer for feature visibility. It defines the canonical layer IDs the frontend is allowed to reason about and the runtime rules the shell uses to decide whether a layer can actually render.

## Purpose and package boundary

- `packages/map-layer-catalog/src/index.types.ts` defines `LayerId`, `LayerGroup`, `LayerDefinition`, and the `LayerCatalog` record shape.
- `packages/map-layer-catalog/src/index.ts` provides the concrete catalog data and catalog-level validation helpers.
- The package is not responsible for drawing layers. It only defines what the layer inventory is and what visibility policy applies to each layer.

## Key exported responsibilities

### Canonical layer inventory

`LAYER_IDS` is the authoritative ordered list of supported runtime layers:

- boundaries: `county`, `state`, `country`
- facilities: `facilities.colocation`, `facilities.hyperscale`
- infrastructure: `power.transmission`, `power.substations`, `power.plants`, `fiber-locator.metro`, `fiber-locator.longhaul`
- parcels: `property.parcels`

That list is the layer identity seam shared by visibility state, style helpers, and app-shell controls.

### Default catalog policy

`DEFAULT_LAYER_CATALOG` attaches policy to every layer ID:

- `group`
- `sourceId`
- `sourceType`
- `zoomMin` and `zoomMax`
- `defaultVisible`
- `dependencies`
- `budgetWeight`

The current defaults intentionally start only the two facilities layers as visible; the rest of the catalog is opt-in.

### Validation and small runtime helpers

- `isLayerId()` narrows arbitrary strings into the supported layer ID union.
- `validateLayerCatalog()` checks key mismatches, invalid zoom ranges, unknown dependencies, and illegal dependencies on boundary layers.
- `visibleLayerCount()` summarizes the current default-visible baseline for tests and diagnostics.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/web/src/features/layers/layer-runtime.service.ts` | Uses `DEFAULT_LAYER_CATALOG`, `LAYER_IDS`, and `validateLayerCatalog()` to compute effective visibility from user intent, zoom, stress blocking, and dependencies. |
| `apps/web/src/features/app/visibility/app-shell-visibility.service.ts` | Seeds the initial shell visibility state from the catalog defaults instead of duplicating booleans in the app shell. |
| `apps/web/src/features/app/core/app-shell.constants.ts` and `features/power/power.layer.types.ts` | Depend on `LayerId` as the shared layer identity type. |
| `packages/map-style` | Derives style-layer helpers from the same `LayerId` union so style-layer lookup stays aligned with the catalog. |

## Layer governance boundary

- The catalog says what a layer is, whether it is visible by default, and what runtime constraints apply.
- The layer runtime in `apps/web` decides whether a user's toggle request can become effective right now.
- Individual feature modules such as facilities, fiber, parcels, and power still own the concrete MapLibre layers and sources they mount.

## Tests and build behavior

`packages/map-layer-catalog/package.json` currently defines:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `bun test`

The current package-local test coverage is focused and concrete:

- `test/default-catalog.test.ts` verifies that the default catalog validates cleanly.
- The same test file locks the current visible-layer baseline to the two facilities layers.
- It also verifies that power layers remain zoom-ungated and that non-boundary layers cannot depend on boundary entries.

## Related docs

- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the shell/runtime code that applies these governance rules.
- Use [Web Feature Domains](/docs/applications/web-feature-domains) for the feature modules that register actual layer controllers under these IDs.
- Use [Map Style](/docs/packages/map-style) for the companion package that maps catalog IDs to concrete style-layer IDs.
