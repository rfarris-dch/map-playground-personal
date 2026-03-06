---
title: Parcel And Tile Workflows
description: The current production-path commands for parcel refresh, canonical load, tile build, publish, and rollback.
---

The parcel and tile flow is one of the clearest operational paths in the repo. The scripts are explicit and should stay explicit.

## Script inventory

| Script | Type | Role |
| --- | --- | --- |
| `scripts/refresh-hyperscale.sh` | operational | Refresh hyperscale sync inputs. |
| `scripts/refresh-parcels.sh` | operational | Start or resume parcel extraction and downstream parcel workflow steps. |
| `scripts/load-parcels-canonical.sh` | operational | Load and swap canonical parcel tables. |
| `scripts/build-parcels-draw-pmtiles.sh` | operational | Build draw PMTiles for parcels. |
| `scripts/publish-parcels-manifest.ts` | operational | Publish the latest parcel tile manifest. |
| `scripts/rollback-parcels-manifest.ts` | operational | Roll back the published parcel manifest. |
| `scripts/init-parcels-schema.sh` | setup | Initialize parcel schema prerequisites. |
| `scripts/run-parcels-sync-launchd.sh` | operational | Launchd-oriented sync execution wrapper. |

## Canonical flow

### 1. Refresh and extract

Start the parcel run with `scripts/refresh-parcels.sh`. This is the entrypoint that kicks off or resumes the run lifecycle.

### 2. Canonical load and swap

Once extraction has produced the expected inputs, `scripts/load-parcels-canonical.sh` moves the data into the serving path.

### 3. Build PMTiles

`scripts/build-parcels-draw-pmtiles.sh` creates the draw tiles used by the frontend parcel layer.

### 4. Publish latest manifest

`scripts/publish-parcels-manifest.ts` updates the `latest.json` pointer for the parcel dataset.

### 5. Roll back when necessary

`scripts/rollback-parcels-manifest.ts` moves the manifest pointer back to a prior publish when coherency or asset quality requires it.

## Development-only vs operational

- Root `bun run dev:*` commands are developer surfaces.
- The parcel refresh, build, publish, and rollback scripts are operational surfaces and should be treated as production-path tools.

## Where these workflows intersect the apps

- `apps/api` exposes parcel sync status and parcel detail endpoints.
- `apps/web` uses the manifest lineage to detect tile/API coherency mismatches.
- `apps/pipeline-monitor` exists to visualize progress across these phases.

## Related runbook entry points

- stalled extraction
- failed canonical load
- failed tile build
- API `409 INGESTION_RUN_MISMATCH`
- CDC drift between write-of-record and read models
