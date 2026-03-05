# PROGRESS

## Purpose

This file is the current implementation snapshot for fast agent handoff.
Use it with `the-research.md` (full plan) to see what is done vs what is next.

## Plan Reference

- Intended full-plan reference: `the-research.md` at repo root.
- Current repo note: that file is not present in this workspace path right now.
- Action if needed: when `the-research.md` is added or moved, update this section with the exact path.

## Snapshot (Current)

- Date: 2026-03-02
- Workspace status: Bun monorepo with Turbo task graph and passing checks.
- Quality gates: `bun run typecheck` and `bun run test` pass.

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
- Completed: parcel contracts added for detail, lookup, and AOI enrichment (`bbox|polygon|county|tileSet`) with profile + geometry mode controls.
- Completed: parcel API slice implemented with DDD split (`parcels.route.ts`, `parcels.repo.ts`, `parcels.mapper.ts`).
- Completed: parcel endpoints added: detail (`GET /api/geo/parcels/:parcel-id`), lookup (`POST /api/geo/parcels/lookup`), enrich (`POST /api/geo/parcels/enrich`).
- Completed: parcel API guardrails enforce AOI caps, tile-set limits, page-size clamping, cursor paging, and request-id propagation.
- Completed: parcel mapper tests added and passing in `apps/api/test/geo/parcels/parcels-mapper.test.ts`.
- Completed: parcel sync loop wiring added to API runtime (`AUTO_PARCELS_SYNC*` controls) with startup-fail option.
- Completed: parcel sync script added (`scripts/refresh-parcels.ts` + `scripts/refresh-parcels.sh`) with Regrid provider assertion, CoreLogic host blocking, and state-partition extraction.
- Completed: PMTiles publish/rollback utilities added (`scripts/publish-parcels-manifest.ts`, `scripts/rollback-parcels-manifest.ts`) with immutable version paths and latest-pointer manifests.
- Completed: canonical parcel schema DDL added (`scripts/sql/parcels-canonical-schema.sql`) with non-partitioned `parcel_current.parcels` and metadata/checkpoint tables.
- Completed: schema bootstrap script added (`bun run init:parcels-schema`).
- Completed: catalog-governed web layer runtime module added (`features/layers/layer-runtime.*`) and facilities toggles now flow through runtime gating.
- Completed: map-engine now supports PMTiles protocol registration lifecycle (`registerPmtilesProtocol`) and exposes layer/source visibility helpers needed by vector parcel layers.
- Completed: parcel web feature slice added (`features/parcels`) with PMTiles source mounting, feature-state hover/select, guardrail gating, and status formatting.
- Completed: parcel controls + parcel detail drawer are wired in `app.vue` with TanStack Query detail fetch and full attributes table rendering.
- Completed: parcel layer is registered under catalog runtime as `property.parcels` with runtime visibility + stress-governor signaling.
- Completed: production load/swap job added (`scripts/load-parcels-canonical.sh`) to stage NDJSON, run QA gates, and atomically promote a fresh canonical table into `parcel_current.parcels`.
- Completed: nationwide draw-tile build job added (`scripts/build-parcels-draw-pmtiles.sh`) to stream canonical geometry into Tippecanoe and convert MBTiles -> PMTiles.
- Completed: parcels refresh orchestration now runs end-to-end (`scripts/refresh-parcels.sh`): extract -> canonical load/swap -> PMTiles build -> manifest publish.
- Completed: tile publish/rollback now normalizes URL paths before filesystem joins, preventing accidental writes to `/tiles` at filesystem root.
- Completed: PMTiles publish hashing is now stream-based (no full-file `readFileSync` memory spike on large nationwide artifacts).
- Completed: tile builder schema metadata path now follows the active snapshot root (`PARCEL_SYNC_OUTPUT_DIR`) and is explicitly passed through orchestrator.
- Completed: tile manifest now records `ingestionRunId`, and parcel detail API enforces optional ingestion-run consistency via `x-parcel-ingestion-run-id`.
- Completed: `tileSet` AOI enrich now uses exact tile-footprint multipolygon intersection (not bbox superset).
- Completed: parcel metadata tables now use text run IDs and are populated on load (`parcel_meta.ingestion_runs`, `parcel_meta.ingestion_checkpoints`).
- Completed: default draw tile profile is now `thin` (full attributes continue through API detail/enrich).

## Current APIs

- `GET /health`
- `GET /api/health`
- `GET /api/geo/facilities?bbox=west,south,east,north&perspective=colocation|hyperscale&limit=number`
- `GET /api/geo/facilities/:facility-id?perspective=colocation|hyperscale`
- `GET /api/geo/parcels/:parcel-id?includeGeometry=none|centroid|simplified|full&profile=analysis_v1|full_170`
- `POST /api/geo/parcels/lookup`
- `POST /api/geo/parcels/enrich`

## Data Pipeline Status (2026-03-02)

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
- Parcels sync runtime controls:
- `AUTO_PARCELS_SYNC=1` enables startup + interval parcel refresh loop.
- `AUTO_PARCELS_SYNC_MODE=external|in-process` controls whether API runs sync internally (default: `external` in production, `in-process` in non-production).
- `AUTO_PARCELS_SYNC_INTERVAL_SECONDS` controls cadence (default weekly interval).
- `AUTO_PARCELS_SYNC_STARTUP_REQUIRED=1` blocks API startup when first parcels sync fails.
- Parcels extraction tooling:
- `bun run sync:parcels` runs state-partition ArcGIS extraction into `PARCEL_SYNC_OUTPUT_DIR` (default `var/parcels-sync`).
- Sync hard-fails if provider metadata does not identify Regrid.
- End-to-end orchestration:
- `bun run sync:parcels` now runs the full pipeline (extract + load/swap + build + publish) in one command.
- Extraction supports deterministic run IDs (`--run-id=<value>`) and output-dir alias (`--out-dir=`) in `scripts/refresh-parcels.ts`.
- Loader conversion path for ArcGIS rings is now PostGIS-compatible (`ST_BuildArea` over parsed rings); no dependency on `ST_GeomFromESRIJSON`.
- Last verified end-to-end smoke run: `RUN_ID=smoke-20260302T021412Z bun run sync:parcels -- --states=DC --max-pages-per-state=1` completed successfully.
- Smoke publish artifacts verified:
- `apps/web/public/tiles/parcels-draw-v1/latest.json`
- `apps/web/public/tiles/parcels-draw-v1/20260302.fcdcad2e.pmtiles`
- Smoke canonical verification: `parcel_current.parcels` row count `2000`, null-geometry count `0`, invalid-geometry count `0`.
- PMTiles publish tooling:
- `bun run tiles:publish:parcels -- --pmtiles-path=<file>` writes immutable version and updates `latest.json`.
- `bun run tiles:rollback:parcels` re-points `latest.json` to the previous published version.

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
- Parcel PMTiles draw layer is mounted with `pid` promoteId, hover/select feature-state, and click-to-detail flow.
- Parcel toggle UI is available and routed through layer runtime visibility controls.
- Parcel guardrails enforce viewport-width and predicted-tile caps before rendering.
- Parcel detail drawer renders lineage/meta plus full attribute payload key/value list from `full_170` detail responses.

## Architecture And Conventions Applied

- Feature-first frontend structure under `apps/web/src/features`.
- Feature modules split into `api.ts`, `*.types.ts`, and `*.service.ts` where useful.
- No pass-through export wrapper files.
- Kebab-case filenames enforced by project convention.
- Immutability defaults added to lint + conventions (`const`, readonly surfaces).
- No fallback or legacy runtime branches without explicit user-directed migration scope.

## Known Gaps Relative To Full Plan

- Not implemented yet: enrichment bundle caching layer (Redis/object-store backed) for AOI analysis prefetch.
- Not implemented yet: dedicated parcel overlay/stats analysis endpoints beyond detail/lookup/enrich.
- Not implemented yet: scheduler deployment wiring for unattended nightly/weekly execution in the target runtime environment.

## Recommended Next Slice

- Deploy scheduler wiring (cron/job runner) that invokes `bun run sync:parcels` on your desired cadence.
- Add AOI enrichment bundle cache and analysis overlay/stats endpoints for spatial tools.

## Key Files To Read First

- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.route.ts`
- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.repo.ts`
- `/Users/robertfarris/map/apps/api/src/geo/facilities/facilities.mapper.ts`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facilities.layer.ts`
- `/Users/robertfarris/map/apps/web/src/features/layers/layer-runtime.service.ts`
- `/Users/robertfarris/map/apps/web/src/features/parcels/parcels.layer.ts`
- `/Users/robertfarris/map/apps/web/src/features/parcels/parcels.service.ts`
- `/Users/robertfarris/map/apps/web/src/features/parcels/components/parcels-controls.vue`
- `/Users/robertfarris/map/apps/web/src/features/parcels/parcel-detail/detail.ts`
- `/Users/robertfarris/map/apps/web/src/features/parcels/parcel-detail/components/parcel-detail-drawer.vue`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facility-detail/detail.ts`
- `/Users/robertfarris/map/apps/web/src/features/facilities/facility-detail/components/facility-detail-drawer.vue`
- `/Users/robertfarris/map/apps/web/src/lib/api-client.ts`
- `/Users/robertfarris/map/apps/api/src/geo/parcels/parcels.route.ts`
- `/Users/robertfarris/map/apps/api/src/geo/parcels/parcels.repo.ts`
- `/Users/robertfarris/map/apps/api/src/geo/parcels/parcels.mapper.ts`
- `/Users/robertfarris/map/packages/contracts/src/index.ts`
- `/Users/robertfarris/map/scripts/refresh-parcels.ts`
- `/Users/robertfarris/map/docs/architecture/ddd.qmd`

## Quick Verification Commands

- `bun run check`
- `bun run typecheck`
- `bun run build`
- `bun run sync:hyperscale`
- `bun run sync:parcels -- --states=TX --max-pages-per-state=2`
- `bun run load:parcels-canonical -- ./var/parcels-sync/<run-id>`
- `bun run tiles:build:parcels -- <run-id>`
- `bun run tiles:publish:parcels -- --pmtiles-path=/abs/path/parcels.pmtiles`
- `bun --filter @map-migration/api dev`
- `curl -i "http://localhost:3001/api/geo/facilities?bbox=-125,24,-66,50&limit=10"`
- `curl -i "http://localhost:3001/api/geo/parcels/<parcel-id>?includeGeometry=centroid&profile=full_170"`
