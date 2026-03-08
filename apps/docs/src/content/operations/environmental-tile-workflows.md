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

This page documents the current production path only. Environmental sync is a data-production swap ahead of the existing PMTiles builders. The web app contract stays fixed.

## Command inventory

| Command | Role |
| --- | --- |
| `bun run sync:environmental-flood` | Full flood run: extract, normalize, build, publish. |
| `bun run sync:environmental-hydro-basins` | Full hydro-basin run: extract, normalize, build, publish. |
| `bun run tiles:build:environmental-flood` | Rebuild flood PMTiles from an already-normalized `flood-hazard.geojson`. |
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

The current flood tile build defaults to a full zoom range of `0-16` unless overridden with:

- `ENVIRONMENTAL_FLOOD_MIN_ZOOM`
- `ENVIRONMENTAL_FLOOD_MAX_ZOOM`

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
2. `loading`
3. `building`
4. `publishing`
5. `completed`
6. `failed`

For environmental runs, `loading` means normalization into the builder-facing GeoJSON contract. It is not a database load.

## Output contracts

Flood normalization writes:

- `normalized/flood-hazard.geojson`

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
