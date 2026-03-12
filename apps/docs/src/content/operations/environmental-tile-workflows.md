---
title: Environmental Tile Workflows
description: The production sync path for FEMA flood and USGS hydro-basin PMTiles, including staging files, marker inventory, and rerun commands.
sources:
  - package.json
  - scripts/refresh-environmental-sync.sh
  - scripts/refresh-environmental-flood.ts
  - scripts/refresh-environmental-hydro-basins.ts
  - scripts/build-environmental-flood-pmtiles.sh
  - scripts/build-environmental-hydro-basins-pmtiles.sh
  - scripts/publish-parcels-manifest.ts
  - scripts/rollback-parcels-manifest.ts
---

This page documents the current production path only. Environmental sync still publishes PMTiles for the web runtime, but flood now also loads the normalized hazard polygons into PostGIS so server-side spatial analysis can query the same normalized source.

## Command inventory

| Command | Role |
| --- | --- |
| `bun run sync:environmental-flood` | Full flood run: extract, normalize, load to PostGIS, build, publish. |
| `bun run sync:environmental-hydro-basins` | Full hydro-basin run: extract, normalize, build, publish. |
| `bun run tiles:build:environmental-flood` | Rebuild flood PMTiles from an already-normalized `flood-hazard.geojson` or `flood-hazard.geojsonl`. |
| `bun run tiles:publish:environmental-flood` | Publish the flood PMTiles artifact for `RUN_ID` or `sample`. |
| `bun run tiles:rollback:environmental-flood` | Roll back the flood manifest by swapping `latest.json` to `previous`. |
| `bun run tiles:build:environmental-hydro-basins` | Rebuild hydro PMTiles from an already-normalized source root. |
| `bun run tiles:publish:environmental-hydro-basins` | Publish the hydro PMTiles artifact for `RUN_ID` or `sample`. |
| `bun run tiles:rollback:environmental-hydro-basins` | Roll back the hydro manifest by swapping `latest.json` to `previous`. |

## Frozen web contracts

Flood remains fixed to:

- dataset: `environmental-flood`
- manifest: `/tiles/environmental-flood/latest.json`
- PMTiles path: `/tiles/environmental-flood/<version>.pmtiles`
- vector source id: `environmental-flood`
- source-layer: `flood-hazard`

The flood tile build is fixed to a full zoom range of `0-16`.

- `ENVIRONMENTAL_FLOOD_MIN_ZOOM` is intentionally not supported for production builds.
- `ENVIRONMENTAL_FLOOD_MAX_ZOOM` remains available when rebuilding a partial archive for maintenance work.

Hydro basins remain fixed to:

- dataset: `environmental-hydro-basins`
- manifest: `/tiles/environmental-hydro-basins/latest.json`
- PMTiles path: `/tiles/environmental-hydro-basins/<version>.pmtiles`
- vector source id: `environmental-hydro-basins`
- source-layers: `huc4-line`, `huc4-label`, `huc6-line`, `huc6-label`, `huc8-line`, `huc8-label`, `huc10-line`, `huc10-label`, `huc12-line`

## Source inputs

Flood requires one of:

- `ENVIRONMENTAL_FLOOD_SOURCE_PATH`
- `ENVIRONMENTAL_FLOOD_SOURCE_URL`

Optional flood inputs:

- `ENVIRONMENTAL_FLOOD_SOURCE_LAYER`
- `ENVIRONMENTAL_FLOOD_DATA_VERSION`
- `ENVIRONMENTAL_FLOOD_TILES_OUT_DIR`

Hydro basins require one of:

- `ENVIRONMENTAL_HYDRO_SOURCE_PATH`
- `ENVIRONMENTAL_HYDRO_SOURCE_URL`

Hydro source handling supports either:

- a multi-layer official datasource such as a WBD geodatabase or zipped datasource
- a directory containing pre-extracted polygon files named `huc4-polygon.geojson`, `huc6-polygon.geojson`, `huc8-polygon.geojson`, `huc10-polygon.geojson`, and `huc12-polygon.geojson`

Optional hydro inputs:

- `ENVIRONMENTAL_HYDRO_HUC4_LAYER`
- `ENVIRONMENTAL_HYDRO_HUC6_LAYER`
- `ENVIRONMENTAL_HYDRO_HUC8_LAYER`
- `ENVIRONMENTAL_HYDRO_HUC10_LAYER`
- `ENVIRONMENTAL_HYDRO_HUC12_LAYER`
- `ENVIRONMENTAL_HYDRO_DATA_VERSION`
- `ENVIRONMENTAL_HYDRO_TILES_OUT_DIR`

Shared optional inputs:

- `RUN_ID`
- `ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT`
- `ENVIRONMENTAL_SYNC_PUBLISH_ROOT`
- `ENVIRONMENTAL_TILES_OUT_DIR`

## Run directories and markers

Flood runs live under `var/environmental-sync/environmental-flood/<RUN_ID>/` by default.

Hydro runs live under `var/environmental-sync/environmental-hydro-basins/<RUN_ID>/` by default.

Each run directory contains:

- `raw/`
- `normalized/`
- `active-run.json`
- `normalize-complete.json`
- `run-config.json`
- `run-summary.json`
- `load-complete.json`
- `tile-build-complete.json`
- `publish-complete.json`
- `postextract-<RUN_ID>.log`

Each dataset root also contains:

- `latest.json`
- `sync.lock/`

`latest.json` is the dataset-local pointer that publish can use when `--run-id` is omitted.

## Phase model

The wrapper uses one shared phase sequence:

1. `extracting`
2. `normalizing`
3. `loading`
4. `building`
5. `publishing`
6. `completed`
7. `failed`

For flood runs, `normalizing` writes `normalized/flood-hazard.geojsonl` for the live ArcGIS path and `normalized/flood-hazard.geojson` for local `ogr2ogr` normalization. `loading` always resolves whichever normalized artifact exists and pushes that canonicalized output into `environmental_current.flood_hazard` plus `environmental_meta.flood_runs`. Hydro-basin runs stay normalization-only and write a synthetic `load-complete.json` marker so the shared wrapper can keep one marker contract.

## Output contracts

Flood normalization writes:

- `normalized/flood-hazard.geojsonl` for the live ArcGIS normalize path
- `normalized/flood-hazard.geojson`

Flood normalize resume state lives in:

- `normalize-progress.json`

The progress artifact records the last committed page boundary, including:

- `writtenCount`
- `processedCount`
- `skippedCount`
- `lastObjectId`
- `pageSize`
- `geometryBatchSize`
- `outputBytes`
- `skippedObjectIds`

Resume is page-boundary-safe:

- the normalizer only checkpoints after a full ArcGIS page is written
- `outputBytes` is the durable resume cursor for `flood-hazard.geojsonl`
- restarting the same `RUN_ID` truncates the GeoJSONL back to the last committed boundary before appending new rows
- if an older run directory only has `writtenCount`, resume rewrites the sequence file back to that committed line count before continuing

Before `load` can start, the ArcGIS normalize artifact must reconcile cleanly:

- `normalized/flood-hazard.geojsonl` byte size must equal `normalize-progress.json.outputBytes`
- durable GeoJSONL line count must equal `normalize-progress.json.writtenCount`
- `processedCount` must equal `writtenCount + skippedCount`
- for the live ArcGIS path, completed normalize also requires `processedCount == run-summary.featureCount`

If any of those checks fail, normalize exits nonzero and `load` refuses to proceed for that `RUN_ID`.

The flood normalizer preserves FEMA provenance fields and emits numeric style fields:

- `DFIRM_ID`
- `FLD_ZONE`
- `ZONE_SUBTY`
- `SFHA_TF`
- `SOURCE_CIT`
- `is_flood_100`
- `is_flood_500`
- `flood_band`
- `legend_key`
- `data_version`

Phase 1 keeps the repo’s existing strict `is_flood_500` rule: zone `X` plus a subtype containing `0.2`.

Flood load then copies that normalized file into PostGIS:

- schema DDL: `scripts/sql/environmental-flood-schema.sql`
- run metadata: `environmental_meta.flood_runs`
- queryable polygons: `environmental_current.flood_hazard`

That means the overlay PMTiles and the API flood-analysis summary now share one normalized upstream artifact instead of maintaining separate source transforms.

## Operator visibility notes

`/api/geo/flood/sync/status` still uses the shared parcel-style phase contract, so flood `normalizing` appears as `extracting` in the response shape. The route now treats progress-ahead-of-file normalize artifacts as failed instead of healthy, but it still is not a byte-for-byte validator for every request.

The current pipeline-monitor app is still parcel-oriented in its mounted UI. Flood status can exist in code paths, but the shipped monitor surface is not yet a first-class flood operator dashboard.

Hydro normalization writes:

- `normalized/huc4-line.geojson`
- `normalized/huc4-label.geojson`
- `normalized/huc6-line.geojson`
- `normalized/huc6-label.geojson`
- `normalized/huc8-line.geojson`
- `normalized/huc8-label.geojson`
- `normalized/huc10-line.geojson`
- `normalized/huc10-label.geojson`
- `normalized/huc12-line.geojson`

Hydro labels are derived for HUC4 through HUC10 only. `huc12-label` is not produced because the runtime never mounts it.

## Rerun story

Use the full sync commands when upstream source data changed or a run must be rebuilt from source:

```bash
bun run sync:environmental-flood
bun run sync:environmental-hydro-basins
```

Use the lower-level commands when staging is already correct:

```bash
RUN_ID=<run-id>
bun run tiles:build:environmental-flood
bun run tiles:publish:environmental-flood

RUN_ID=<run-id>
bun run tiles:build:environmental-hydro-basins
bun run tiles:publish:environmental-hydro-basins
```

Rollback stays manifest-only:

```bash
bun run tiles:rollback:environmental-flood
bun run tiles:rollback:environmental-hydro-basins
```

Rollback does not rebuild or delete PMTiles files. It only swaps `latest.json` back to the previous published entry.

## Recovery for a bad in-flight run

If an ArcGIS normalize run reports more progress than the durable GeoJSONL actually contains, do not let that run advance into `load`, `build`, or `publish`.

Use one of these recovery paths:

- stop the active wrapper and start a fresh `RUN_ID`
- quarantine the suspect run directory so auto-resume will not pick it up
- or delete/reset that run's `normalized/flood-hazard.geojsonl` plus `normalize-progress.json` before restarting normalize for the same `RUN_ID`

Keep `environmental_current.flood_hazard` and `/tiles/environmental-flood/latest.json` on the last known good run until the new normalize artifact passes the reconciliation checks above.
