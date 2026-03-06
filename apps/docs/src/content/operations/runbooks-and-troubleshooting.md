---
title: Runbooks And Troubleshooting
description: Operational recovery entry points for parcel sync, tile publish, coherency, and drift issues.
searchTerms:
  - runbook
  - troubleshooting
  - stalled extraction
  - canonical load
  - tile build
  - ingestion mismatch
  - cdc drift
sources:
  - docs/runbooks/spatial-analysis-ops.md
  - docs/architecture/spatial-analysis-kickoff-checklist.md
  - scripts/refresh-parcels.sh
  - scripts/load-parcels-canonical.sh
  - scripts/build-parcels-draw-pmtiles.sh
  - scripts/publish-parcels-manifest.ts
  - scripts/rollback-parcels-manifest.ts
  - scripts/run-parcels-sync-launchd.sh
  - packages/contracts/src/api-contracts.ts
  - apps/api/src/geo/parcels/route/parcels-sync-status.route.ts
  - apps/api/src/sync/parcels-sync/snapshot-read.service.ts
  - apps/api/src/sync/parcels-sync/status-store.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts
---

The preserved source-of-truth artifact for this topic is `docs/runbooks/spatial-analysis-ops.md`, now available in the docs app as [Spatial Analysis Ops Runbook](/docs/artifacts/spatial-analysis-ops). This page is the operator-facing version of that guidance: it keeps the same failure modes, but updates the routing to the current repo surfaces and makes the checks, actions, and exit criteria easier to scan during an incident.

:::note
The imported runbook artifact intentionally preserves older wording such as `GET /api/parcels/sync/status`. The current shared contract and API route are `GET /api/geo/parcels/sync/status`, so use the route shown on this page when working a live incident.
:::

## Required triage inputs

Capture these before you change anything:

- run ID and request ID
- current sync snapshot from `GET /api/geo/parcels/sync/status`
- `var/parcels-sync/active-run.json`
- `var/parcels-sync/latest.json`
- the relevant `var/parcels-sync/postextract-<RUN_ID>.log`
- the live manifest at `apps/web/public/tiles/parcels-draw-v1/latest.json`

The current operator surfaces line up like this:

| Surface | Why it matters during triage |
| --- | --- |
| `scripts/refresh-parcels.sh` | Authoritative top-level runner for extract, load, build, publish, and failure marker updates. |
| `GET /api/geo/parcels/sync/status` | Sanitized API read model of the same filesystem-backed sync state. |
| `apps/pipeline-monitor` | Operator UI that polls the sync-status route and summarizes the run phases, warnings, and live rates. |
| `apps/web/public/tiles/parcels-draw-v1/latest.json` | Live manifest pointer that determines which parcel PMTiles artifact the frontend loads. |
| [Spatial Analysis Ops Runbook](/docs/artifacts/spatial-analysis-ops) | Preserved legacy artifact and source material for the incident patterns documented here. |

## Incident routing guide

| Failure mode | Primary evidence | First response |
| --- | --- | --- |
| Stalled extraction | `active-run.json` stops updating during `extracting` | Resume the same run with `scripts/refresh-parcels.sh` and confirm the API snapshot advances. |
| Failed canonical load | `loading` phase stalls or `db-load:*` summaries fail | Re-run `scripts/load-parcels-canonical.sh` for the same extracted run. |
| Failed tile build | `building` transitions to `failed` or no PMTiles artifact is written | Fix dependencies or stale build locks, then rebuild the same run. |
| Coherency mismatch | Parcel detail returns `INGESTION_RUN_MISMATCH` | Compare manifest lineage to API lineage, then publish or roll back the manifest. |
| Drift-related operational issue | mirrored data no longer matches the write-of-record | Treat this as CDC/backfill work: compare counts and timestamps, inspect lag, then repair the affected window. |

## Stalled extraction

### Required inputs

- `RUN_ID`
- current API snapshot from `GET /api/geo/parcels/sync/status`
- `var/parcels-sync/active-run.json`
- the newest `state-*.checkpoint.json` files under `var/parcels-sync/<RUN_ID>/`

### Checks

```bash
cat var/parcels-sync/active-run.json
curl -H "x-request-id: ops-$(date +%s)" http://localhost:3001/api/geo/parcels/sync/status
ls -la "var/parcels-sync/$RUN_ID"/state-*.checkpoint.json
```

Confirm all three of these before you restart anything:

- `phase` is still `extracting`
- `active-run.json.updatedAt` is no longer moving even though `isRunning` is still `true`
- checkpoint files are not advancing for the active states

### Actions

Resume the same run ID instead of creating a second extraction:

```bash
RUN_ID=<run-id>
bash scripts/refresh-parcels.sh --run-id="$RUN_ID"
```

If this run is launched by `launchd`, use `scripts/run-parcels-sync-launchd.sh` for the next scheduled attempt after the current incident response is complete. Do not start multiple manual wrappers in parallel; `refresh-parcels.sh` already enforces the sync lock under `var/parcels-sync/sync.lock`.

### Exit criteria

- the run advances to `loading`
- or the run moves to `failed` with a clear summary and actionable error
- the API snapshot and pipeline monitor both reflect the new phase change

## Failed canonical load

### Required inputs

- `RUN_ID`
- `var/parcels-sync/active-run.json`
- `var/parcels-sync/<RUN_ID>/run-summary.json`
- `var/parcels-sync/<RUN_ID>/db-stage-complete.json` if it exists

### Checks

```bash
tail -n 200 var/parcels-sync/active-run.json
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM parcel_build.parcels;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM parcel_build.parcels_stage_raw;"
```

Look for these signals:

- the run is stuck in `loading`
- `summary` or `progress.dbLoad.stepKey` shows a failed or stalled `db-load:*` step
- the stage table or materialized table counts are inconsistent with the extracted run

### Actions

Re-run only the database phase for the same extracted run:

```bash
RUN_ID=<run-id>
bash scripts/load-parcels-canonical.sh "var/parcels-sync/$RUN_ID" "$RUN_ID"
```

This is the right recovery path when extraction has already completed. The load script will reuse staged input for the same run when `db-stage-complete.json` is already present, keep `active-run.json` in the `loading` phase while it works, and write the next phase markers only after the swap is complete.

### Exit criteria

- `swap-current` completed successfully
- `parcel_meta.ingestion_runs` contains the successful `run_id`
- the API snapshot leaves `loading` and the pipeline monitor shows the run progressing again

## Failed tile build

### Required inputs

- `RUN_ID`
- `var/parcels-sync/postextract-<RUN_ID>.log`
- `.cache/tiles/parcels-draw-v1/`
- `var/parcels-sync/<RUN_ID>/tile-build-complete.json` if it exists

### Checks

```bash
RUN_ID=<run-id>
tail -n 200 "var/parcels-sync/postextract-${RUN_ID}.log"
command -v tippecanoe pmtiles psql jq
ls -la ".cache/tiles/parcels-draw-v1/"*"${RUN_ID}"*.build.lock
```

Validate the common failure causes first:

- `tippecanoe`, `pmtiles`, `psql`, and `jq` are installed
- there is no stale build lock for the same run
- the build log did not stop before writing `PMTILES_PATH`
- the schema metadata file for the run still exists when using the schema-aware profile

### Actions

1. Remove or clear stale lock ownership only if the original build process is gone.
2. Fix the missing dependency, temp-directory, or source-data issue shown in `postextract-<RUN_ID>.log`.
3. Re-run the build and publish steps for the same run ID:

```bash
RUN_ID=<run-id>
bash scripts/build-parcels-draw-pmtiles.sh "$RUN_ID"
bun run tiles:publish:parcels -- --dataset=parcels-draw-v1 --run-id="$RUN_ID"
```

### Exit criteria

- the `.pmtiles` artifact exists under `.cache/tiles/parcels-draw-v1/`
- `tile-build-complete.json` exists for the run
- `latest.json` now points at the expected version after publish

## Coherency mismatch: API vs tile manifest

### Required inputs

- parcel ID that reproduced the issue
- request ID from the failing parcel-detail request
- `apps/web/public/tiles/parcels-draw-v1/latest.json`
- live parcel detail response for the same parcel

### Checks

```bash
jq -r '.current.ingestionRunId' apps/web/public/tiles/parcels-draw-v1/latest.json
curl "http://localhost:3001/api/geo/parcels/<parcel-id>" | jq -r '.feature.lineage.ingestionRunId'
```

Treat this as a coherency incident when:

- parcel detail returns `INGESTION_RUN_MISMATCH`
- the manifest `current.ingestionRunId` does not match the API lineage run ID
- the pipeline monitor shows the sync run completed, but the frontend is still loading an older or incorrect manifest pointer

### Actions

1. Compare the manifest lineage and API lineage directly.
2. If the PMTiles artifact is correct but the manifest pointer is wrong, republish it:

```bash
RUN_ID=<run-id>
bun run tiles:publish:parcels -- --dataset=parcels-draw-v1 --run-id="$RUN_ID"
```

3. If the latest publish itself is bad, roll back the manifest only:

```bash
bun run tiles:rollback:parcels -- --dataset=parcels-draw-v1
```

4. Purge CDN cache for `latest.json` if cached clients are still seeing the wrong pointer.
5. Ask the user or operator to retry the parcel-detail request after the manifest is corrected.

### Exit criteria

- `latest.json.current.ingestionRunId` matches the parcel-detail lineage
- `INGESTION_RUN_MISMATCH` falls back to baseline
- parcel detail can be retrieved again without repeated UI retry loops

## Drift-related operational issues

### Scope

The repo still treats drift as a CDC and mirrored-data problem, not as a dedicated parcel script. The preserved runbook and the kickoff checklist call out `saved_views`, entitlements, and other mirrored model rows as the main write-of-record surfaces that can drift between stores.

### Required inputs

- the affected table or feature surface
- row-count comparison between source and mirror
- maximum `updated_at` timestamps on both sides
- CDC consumer lag and dead-letter evidence

### Checks

- compare row counts and the latest update timestamps between the write-of-record store and the mirrored read copy
- inspect CDC consumer lag and dead-letter logs
- confirm whether the issue is a data-lag problem, a dead consumer, or a bad transformation/backfill window
- verify whether alerting for this class of drift exists at all; the current architecture checklist still treats alerting as unfinished work

### Actions

1. Restart or repair the CDC consumer if it is down.
2. Backfill the affected primary-key or time window once the consumer is healthy again.
3. Add or restore drift alerting if the incident exposed that the repo is missing an alarm for this failure mode.

:::warning
There is no first-class repo script here that performs a complete CDC drift repair in one command. Keep the docs honest: this is currently investigation plus targeted backfill work, not a single scripted rollback path like manifest rollback.
:::

### Exit criteria

- mirrored row counts converge with the write-of-record
- lag returns below the agreed threshold
- the missing alert or dead-letter visibility gap is corrected if that caused the incident

## Exit-criteria discipline

Every incident path in this repo should end with an explicit stop condition instead of “watch it and see.” Use the API snapshot, the pipeline monitor, the marker files under `var/parcels-sync/<RUN_ID>/`, and the live manifest as the four confirmation surfaces before closing the incident.

## Related pages

- [Spatial Analysis Ops Runbook](/docs/artifacts/spatial-analysis-ops): the preserved legacy artifact this page expands and updates.
- [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows): command inventory, artifact paths, publish rules, and rollback behavior.
- [API Runtime Foundations](/docs/applications/api-runtime): worker lifecycle, route registration, runtime config, and HTTP boundary details.
- [API Parcels And Sync](/docs/applications/api-parcels-and-sync): the parcel slice that exposes the sync status route and parcel detail lineage.
- [Pipeline Monitor](/docs/applications/pipeline-monitor): the operator UI over the same sync-status snapshot.
- [Sync Architecture](/docs/data-and-sync/sync-architecture): cross-app map of scripts, worker loops, API reads, and monitor behavior.
