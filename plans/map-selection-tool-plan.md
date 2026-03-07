# Map Selection Tool Plan

## Goal

Create a dedicated selection tool that consumes geometry from the map and returns an aggregate view of facility data plus market data.

The live app already exposes selection as its own concept through separate controls such as:

- `Select feature`
- `Select by rectangle`
- `Select by lasso`
- `Analysis tool`

The current repo does not have that separation yet. Selection is still hidden inside the measure flow.

## Why This Is Separate Work

The current selection workflow is not a standalone tool. It is embedded inside the measure flow and only aggregates facilities plus parcels.

Relevant current seams:

- `apps/web/src/features/app/measure-selection/measure-selection.service.ts`
- `apps/web/src/features/app/measure-selection/use-measure-selection-summary.ts`
- `apps/web/src/features/measure/measure-analysis.service.ts`
- `apps/api/src/geo/facilities/route/facilities-selection.route.ts`

That implementation does not currently include market aggregation.

## Current State In This Repo

### What exists

- Polygon-based facility selection via `facilities-selection.route.ts`
- Parcel enrichment pagination through the spatial-analysis parcel helpers
- Frontend selection summary assembly for:
  - colocation facilities
  - hyperscale facilities
  - parcel summaries
  - provider rollups

### What does not exist

- market-boundary geometry in the frontend runtime
- a spatial market-selection API
- any market aggregation in the selection summary
- a standalone selection panel or selection state domain

The only market surface in this repo today is a table route:

- `apps/api/src/geo/markets/markets.route.ts`
- `apps/web/src/pages/markets-page.vue`

That route is tabular and not spatial.

## Product Context

Obsidian notes describe the map as a discovery surface where users mark up areas and then move into market views. They also note that market boundaries are subjective, research-defined polygons. That means market aggregation is not just a frontend rollup problem. It depends on a real boundary dataset.

Live app exploration also shows that the product model expects selection and analysis to exist independently of pure measurement. The current repo should follow that same mental model rather than extending the overloaded measure panel.

## Proposed Product Boundary

Create a dedicated `Selection` tool with these responsibilities:

- accept a completed polygon or shape from the sketch tool
- run facility aggregation
- run market intersection and market-summary aggregation
- optionally run parcel enrichment if site-selection workflows still need it
- present results in a selection-specific panel
- export selection summaries independently of drawing

Support these entry actions in the first version:

- select single feature
- select by rectangle
- select by lasso
- analyze current selection

Keep these responsibilities out of the selection tool:

- drawing and distance creation
- generic map export
- ad hoc sketch markup behavior

## Required Backend Additions

### 1. Market boundary source

Add a market-boundary dataset with stable identifiers and polygon geometry.

The repo currently has boundary support for:

- county
- state
- country

It does not have market boundaries.

This is the largest missing backend piece relative to the live app and the Obsidian notes. Market pages clearly exist in production, but this repo does not yet expose market geometry as a reusable spatial contract.

### 2. Spatial market-selection contract

Add a backend route for market aggregation by geometry, for example:

- `POST /api/geo/markets/selection`

Suggested request shape:

- geometry polygon
- aggregation mode
- optional intersection threshold

Suggested response shape:

- matched markets
- primary market if one dominates
- intersection area or percent overlap
- market metadata needed by downstream navigation

### 3. Shared contract updates

Add shared request and response schemas in `packages/contracts` so the frontend can treat market selection like the facilities-selection flow.

## Required Frontend Additions

### 1. Create a dedicated feature domain

Add a new feature folder such as:

- `apps/web/src/features/selection-tool`

Suggested file split:

- `selection-tool.types.ts`
- `selection-tool.service.ts`
- `selection-tool.api.ts`
- `components/selection-tool-panel.vue`
- `use-selection-tool.ts`

### 2. Separate shell state

Move selection state out of the measure-specific shell domain. The shell should own:

- current selection geometry
- selection tool panel state
- last successful selection result
- selection loading and error state

### 3. Compose market and facility summaries

The selection summary should include:

- facility totals by perspective
- top providers
- selected facilities list
- matched markets
- primary market
- overlap metadata
- optional parcel summary if site-selection remains in scope

### 4. Support explicit handoff from sketch

The selection tool should start from an explicit action rather than implicit completion side effects.

Examples:

- `Analyze This Shape`
- `Create Selection`

## Suggested Delivery Order

1. Introduce market-boundary source data and API contract.
2. Build a backend polygon-to-market selection route.
3. Add a frontend selection-tool feature that calls both facility and market selection APIs.
4. Move the current measure-selection panel into the new feature.
5. Decide whether parcel enrichment stays in the default selection path or becomes a secondary tab.

## Open Questions

- Is parcel enrichment part of the default selection workflow, or should it be optional?
- Should market aggregation return one primary market, all intersecting markets, or both?
- What overlap threshold should count as a market match when a drawn shape crosses boundaries?
- Does the selection summary need company rollups in the first version or only market plus facility data?

## Risks

- Without authoritative market polygons, the feature cannot be implemented cleanly.
- If market aggregation is done only in the frontend using existing table data, results will be wrong.
- If parcel enrichment stays mandatory for every selection, performance may become the limiting factor instead of facility and market aggregation.

## Dependencies

- Requires market-boundary data that does not exist in this repo today.
- Depends on the sketch and measure split so geometry ownership is clean.

## Acceptance Criteria

- Users can create a selection without entering the sketch and measure panel.
- A completed selection returns facility and market summaries from explicit selection APIs.
- Market matches are based on real market polygons, not table-only metadata.
- Selection results can be revisited or exported without re-entering drawing mode.
- Rectangle and lasso selection are first-class entry points rather than hidden side effects of measurement completion.
