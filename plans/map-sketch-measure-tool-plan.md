# Map Sketch And Measure Tool Plan

## Goal

Create a dedicated sketch and measure tool that owns drawing and distance workflows without also owning selection analysis, CSV export, or image export.

## Why This Needs A Real Split

The current map surface treats `Measure` as one umbrella workflow, but it is carrying multiple product jobs:

- distance measurement
- area drawing with freeform, rectangle, and circle shapes
- geometry completion and selection analysis
- image export mode switching
- CSV export from the analysis panel

That coupling is visible in the current frontend seams:

- `apps/web/src/features/measure/measure.types.ts`
- `apps/web/src/features/measure/components/measure-toolbar.vue`
- `apps/web/src/features/app/components/map-measure-tools.vue`
- `apps/web/src/features/app/measure-selection/use-app-shell-measure-selection.ts`

Product notes from Obsidian also describe drawing, measurement, and print as separate map tools rather than one overloaded workflow.

Live app exploration on `app.datacenterhawk.com` reinforces that target model. The authenticated `Global Map`, `Market Map`, and `Company Map` surfaces already expose separate controls for:

- select feature
- select by rectangle
- select by lasso
- draw point, polyline, polygon, rectangle, and circle
- distance
- area
- analysis
- export

That means this plan is not inventing a new interaction model. It is a parity and decomposition plan for the current repo.

## Current State In This Repo

- The runtime only models `off`, `distance`, and `area` in `MeasureMode`.
- The area workflow is also the source of selection geometry.
- The toolbar exposes both analysis and image-export output modes.
- Completing an area selection can immediately trigger export behavior.
- The shell has one `isMeasurePanelOpen` state and one set of measure actions.

This means any future work on sketch markup, persistent annotations, or selection-specific UX will continue to pile onto the same feature unless the tool is split first.

## Proposed Product Boundary

Create a dedicated `Sketch / Measure` tool with these responsibilities:

- draw line distance measurements
- draw ad hoc sketch geometry for markup
- support freeform, rectangle, and circle geometry creation
- support clear, finish, and optional rename or color styling later
- expose completed geometry to other tools without owning downstream analysis

Move these responsibilities out of the sketch and measure tool:

- facility aggregation
- parcel aggregation
- market aggregation
- CSV export
- map export
- selection-specific summary UI

Target parity with the live product should map the current repo toward these conceptual tools:

- `Sketch` for drawing and markup geometry
- `Measure` for distance and area calculations
- `Selection` for feature and market analysis
- `Export` for print and image outputs

## Recommended Architecture

### 1. Split feature ownership

Refactor the current stack into two feature domains:

- `features/sketch-measure`
- `features/selection`

The existing geometry math in `features/measure/measure.service.ts` is a good base for the sketch runtime and can be retained with renamed types and clearer boundaries.

### 2. Replace output-mode coupling

Remove `MeasureSelectionOutputMode` from the sketch and measure surface.

The current `analysis | image` switch is a sign that the tool is mixing authoring with downstream actions. That state should move into the selection/export domain or be removed entirely from the drawing runtime.

### 3. Add explicit geometry handoff

The sketch tool should expose a typed completed-geometry result:

- active draft geometry
- completed geometry
- geometry type
- measurement stats

The selection tool can then consume that geometry by explicit user action such as:

- `Use Sketch As Selection`
- `Analyze Selection`

This mirrors the live app more closely than the current repo does. The live app separates geometry authoring controls from the analysis and export controls even though they share one map toolbar.

### 4. Keep route-level UI thin

The map page should continue composing thin presentational surfaces. The shell should own:

- panel open state
- active tool
- geometry handoff between tools

The sketch feature should own:

- geometry creation lifecycle
- display-ready metrics
- overlay rendering state

## Implementation Workstreams

### Frontend state and orchestration

- Replace `measureState` with a sketch and measure specific state object.
- Rename shell refs and actions in `use-app-shell-state.ts` and `use-app-shell.ts`.
- Replace `isMeasurePanelOpen` with a more general tool-panel concept if selection will become its own panel.

### Feature refactor

- Move current geometry runtime and service logic into a dedicated sketch and measure feature folder.
- Keep type contracts in `*.types.ts` and pure geometry helpers in `*.service.ts` files.
- Preserve the existing map-layer controller approach so the runtime still mounts through the app lifecycle services.

### UI refactor

- Replace the current `Measure` panel copy and controls with a sketch and measure specific surface.
- Remove analysis and export controls from the sketch toolbar.
- Keep distance and shape creation controls in the sketch tool.

### Backward-compatible bridge

- For the first pass, the selection tool can still read the same completed polygon ring shape the current measure workflow produces.
- That keeps the runtime stable while the UI and shell are decomposed.

## Suggested Delivery Order

1. Extract and rename the current measure runtime without changing behavior.
2. Remove `analysis` and `image` output state from the tool.
3. Add explicit geometry handoff from sketch to selection.
4. Move selection summary and export actions into the new selection tool.
5. Rename UI labels and analytics hooks after behavior stabilizes.

## Risks

- If the split happens only at the component level and not at the state level, the coupling will remain.
- If geometry handoff is implicit, selection bugs will continue to look like drawing bugs.
- If the first pass tries to add persistent annotations and selection redesign together, scope will expand quickly.

## Dependencies

- No new backend contract is required for the split itself.
- The split should happen before implementing the separate selection tool.

## Acceptance Criteria

- The sketch and measure tool can draw distance and area geometry without showing selection analysis or export controls.
- The selection workflow is initiated separately from drawing.
- The shell state no longer uses output-mode switches to decide whether drawing means analysis or image export.
- Existing drawing interactions still work for freeform, rectangle, and circle modes.
- The resulting tool model is structurally closer to the live app toolbar than the current all-in-one `Measure` panel.
