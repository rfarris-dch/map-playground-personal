# PROGRESS

## Purpose

This file is the current implementation snapshot for fast agent handoff.
Use it with `the-research.md` (full plan) to see what is done vs what is next.

## Plan Reference

- Intended full-plan reference: `the-research.md` at repo root.
- Current repo note: that file is not present in this workspace path right now.
- Action if needed: when `the-research.md` is added or moved, update this section with the exact path.

## Snapshot (Current)

- Date: 2026-03-01
- Workspace status: Bun monorepo with Turbo task graph and passing checks.
- Quality gates: `bun run typecheck`, `bun run sync:hyperscale`, and `apps/api bun run test` pass.

## Milestones Completed (Mapped To Plan)

- Completed: contracts-first shared API surfaces in `packages/contracts`.
- Completed: facilities vertical slice is implemented end-to-end.
- Completed: API endpoint `GET /api/geo/facilities` supports required `bbox` and optional `limit`.
- Completed: web request client adds and propagates `x-request-id`.
- Completed: web response parsing is schema-validated via Zod contracts.
- Completed: map overlay is viewport-driven (`moveend` + debounce + cancellation).
- Completed: stale response protection added to facilities layer (`requestSequence` guard).
- Completed: abort requests are treated as expected control flow (`reason: "aborted"`), not network failures.
- Completed: map engine exposes `getBounds`, `getZoom`, and `setGeoJSONSourceData`.
- Completed: `maplibre-gl` is a peer dependency in `@map-migration/map-engine`.
- Completed: TanStack Query is wired and used for diagnostics health query.
- Completed: facilities API is Postgres-only (fixtures and source-mode fallback removed).
- Completed: Postgres-backed facilities read path added with repository + mapper.
- Completed: facility detail API endpoint `GET /api/geo/facilities/:facility-id`.
- Completed: map engine click support added via engine-neutral `onClick` / `offClick`.
- Completed: facilities layer supports click selection + feature-state highlight.
- Completed: selected facility detail query is wired in web via TanStack Query.
- Completed: API graceful shutdown closes Postgres pool.
- Completed: facilities contract now models perspective semantics (`colocation` vs `hyperscale`).
- Completed: facilities list/detail responses include commissioned semantic and lease/own flags.
- Completed: facilities API now accepts `perspective` query param for bbox and detail.
- Completed: facility selection UI is now a feature-owned map overlay drawer with explicit close/unselect.
- Completed: facilities layer controller now exposes `clearSelection()` for UI-driven unselect.
- Completed: facilities status is structured state (not raw strings), with formatted display in app shell.
- Completed: facilities map uses GeoJSON clustering with cluster count bubbles that split by zoom.
- Completed: map mounts both perspectives concurrently (`colocation` + `hyperscale`) with independent status.
- Completed: perspective color semantics applied in-map (colocation blue, hyperscale orange).
- Completed: facilities detail feature is split into `features/facilities/facility-detail` with UI moved under `components/`.
- Completed: facilities layer entry filename renamed from `layer.ts` to `facilities.layer.ts`.
- Completed: OpenFreeMap glyph 404 spam removed by switching cluster label font to `Noto Sans Bold`.
- Completed: canonical hyperscale refresh workflow added as `bun run sync:hyperscale`.
- Completed: mirror parity restored for hyperscale tables (MySQL and Postgres mirror row counts now match).
- Completed: `serve.hyperscale_site` repopulated from current spatial data (Postgres-only serving path remains intact).
- Completed: API startup now runs hyperscale sync automatically and schedules periodic refresh (no manual sync required).
- Completed: hyperscale sync writes `mirror.mirror_sync_meta` checkpoints for facility/provider/history tables.
- Completed: hyperscale commissioning semantics now include `under_construction` and `planned` and are mapped into contracts/API/web.
- Completed: hyperscale refresh now follows HawkSuite-style status semantics and no longer applies incorrect `/1000` power scaling.
- Completed: sync script now normalizes semantic check constraints so sync/startup does not fail on valid planned/under-construction rows.
- Completed: facilities hover is centralized in `features/facilities/hover.ts` and drives feature-state highlight + tooltip overlay.
- Completed: map controls (navigation, scale, fullscreen) are mounted through `IMap.addControl/removeControl`.
- Completed: facilities overlays now support visibility toggles with per-perspective status HUD and legend.
- Completed: a feature-owned measure module (`features/measure`) now supports distance and area modes with map overlay + toolbar.

## Current APIs

- `GET /health`
- `GET /api/health`
- `GET /api/geo/facilities?bbox=west,south,east,north&perspective=colocation|hyperscale&limit=number`
- `GET /api/geo/facilities/:facility-id?perspective=colocation|hyperscale`

## Data Pipeline Status (2026-03-01)

- Mirror definition: `mirror.*` is a raw MySQL-to-Postgres replica schema (source-aligned tables used as staging input for spatial/serve layers).
- Hyperscale parity status:
- MySQL `HYPERSCALE_FACILITY=17369`, `HYPERSCALE_PROVIDER=232`, `HYPERSCALE_HISTORICAL_CAPACITY=65762`.
- Postgres `mirror."HYPERSCALE_FACILITY"=17369`, `mirror."HYPERSCALE_PROVIDER"=232`, `mirror."HYPERSCALE_HISTORICAL_CAPACITY"=65762`.
- Spatial/serve status after refresh:
- `spatial.hyperscale_facility_features=2031`.
- `serve.hyperscale_site=1535` (filtered canonical serving rows with valid state + county FIPS constraints).
- Automatic refresh behavior:
- `AUTO_HYPERSCALE_SYNC=1` enables startup + interval sync in API runtime.
- `AUTO_HYPERSCALE_SYNC_INTERVAL_SECONDS` controls cadence (default `300`).
- `AUTO_HYPERSCALE_SYNC_STARTUP_REQUIRED=1` fails API startup if first sync fails.
- Last verified run: `bun run sync:hyperscale` exited `0` on 2026-03-01 with mirror parity preserved and `serve.hyperscale_site=1535`.
- Semantic model alignment: hyperscale now emits `leased|operational|under_construction|planned|unknown`.

### Facilities Endpoint Behavior

- `bbox` is required and validated.
- `perspective` defaults to `colocation` and validates against `colocation|hyperscale`.
- `limit` is clamped to perspective-specific query max rows in `packages/geo-sql`.
- Endpoint queries Postgres and maps rows to typed GeoJSON features.
- No runtime fallback source mode is supported.
- All responses include `x-request-id`.
- Detail endpoint returns nullable power fields to preserve missing-data semantics.

## Frontend Status

- `app.vue` mounts map and facilities overlay.
- Facilities overlay refreshes on viewport movement with debouncing.
- Aborted fetches do not clear layer data or spam status.
- Older in-flight responses cannot overwrite newer results.
- Clicking a facility sets feature-state selection and triggers detail fetch.
- Clusters show aggregate counts when zoomed out and split progressively with zoom.
- App map renders selected facility details in a feature-owned drawer overlay.
- Facility drawer close action clears feature-state selection through the layer controller.
- Facilities detail query/service/types and drawer UI are colocated under `features/facilities/facility-detail`.
- Facilities cluster labels use a glyph family hosted by the active OpenFreeMap style.
- Health status query is active through TanStack Query.
- Facilities hover is ephemeral and rendered via a dedicated tooltip component with commissioned semantic/power and lease-or-own fields.
- Facilities interactions are mode-gated so measurement mode suppresses facility hover/click selection.
- Layer visibility toggles can halt fetch/render for each perspective via `setVisible()`.
- Distance/area measurement overlay is available with clear + live metric readouts.

## Architecture And Conventions Applied

- Feature-first frontend structure under `apps/web/src/features`.
- Feature modules split into `api.ts`, `*.types.ts`, and `*.service.ts` where useful.
- No pass-through export wrapper files.
- Kebab-case filenames enforced by project convention.
- Immutability defaults added to lint + conventions (`const`, readonly surfaces).
- No fallback or legacy runtime branches without explicit user-directed migration scope.

## Known Gaps Relative To Full Plan

- Not implemented yet: broader endpoint classes beyond current facilities/health slice.

## Recommended Next Slice

- Add county boundary + metrics slice for area-level analysis.
- Add parcel/PMTiles overlay using the same visibility + interaction gating used for facilities.
- Add layer-catalog/style invariant wiring in CI for deterministic ordering.

## Key Files To Read First

- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.route.ts`
- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.repo.ts`
- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.mapper.ts`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facilities.layer.ts`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facility-detail/detail.ts`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facility-detail/components/facility-detail-drawer.vue`
- `/Users/robertfarris/map/apps/web/src/lib/api-client.ts`
- `/Users/robertfarris/map/packages/contracts/src/index.ts`
- `/Users/robertfarris/map/docs/architecture/ddd.qmd`

## Quick Verification Commands

- `bun run check`
- `bun run typecheck`
- `bun run build`
- `bun run sync:hyperscale`
- `bun --filter @map-migration/api dev`
- `curl -i "http://localhost:3001/api/geo/facilities?bbox=-125,24,-66,50&limit=10"`
