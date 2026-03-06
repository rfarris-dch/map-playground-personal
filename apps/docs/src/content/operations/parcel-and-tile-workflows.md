---
title: Parcel And Tile Workflows
description: The repo-level operational commands, artifacts, and production-path flow for parcel ingestion, canonical load, PMTiles build, publish, and rollback.
sources:
  - package.json
  - scripts/refresh-hyperscale.sh
  - scripts/init-parcels-schema.sh
  - scripts/refresh-parcels.sh
  - scripts/refresh-parcels.ts
  - scripts/load-parcels-canonical.sh
  - scripts/build-parcels-draw-pmtiles.sh
  - scripts/publish-parcels-manifest.ts
  - scripts/rollback-parcels-manifest.ts
  - scripts/run-parcels-sync-launchd.sh
  - packages/geo-tiles/src/index.ts
---

This page documents the current production path only. The repo already has explicit shell and TypeScript entrypoints for parcel refresh, canonical load, PMTiles build, publish, and rollback. Operators should use those commands directly instead of inventing alternate workflows.

## Command inventory

The root `package.json` scripts are the preferred operator-facing entrypoints because they keep the repo path stable even when the underlying shell or TypeScript file changes.

| Command | Type | Underlying entrypoint | Current role |
| --- | --- | --- | --- |
| `bun run init:parcels-schema` | setup | `scripts/init-parcels-schema.sh` | Applies `scripts/sql/parcels-canonical-schema.sql` so the parcel schemas and core tables exist before a load. |
| `bun run sync:hyperscale` | operational | `scripts/refresh-hyperscale.sh` | Refreshes mirrored hyperscale inputs and rebuilds the derived spatial serving tables. |
| `bun run sync:parcels` | operational | `scripts/refresh-parcels.sh` | Primary parcel run wrapper: extract, canonical load, PMTiles build, and manifest publish. |
| `bun run load:parcels-canonical` | operational | `scripts/load-parcels-canonical.sh` | Re-runs only the database load and swap phase from an extracted snapshot. |
| `bun run tiles:build:parcels` | operational | `scripts/build-parcels-draw-pmtiles.sh` | Rebuilds the `parcels-draw-v1` PMTiles artifact from `parcel_current.parcels`. |
| `bun run tiles:publish:parcels` | operational | `scripts/publish-parcels-manifest.ts` | Copies the PMTiles artifact into the web publish root and advances `latest.json`. |
| `bun run tiles:rollback:parcels` | operational | `scripts/rollback-parcels-manifest.ts` | Swaps `latest.json` back to the previous published PMTiles artifact. |
| `bash scripts/run-parcels-sync-launchd.sh` | operational scheduler wrapper | `scripts/run-parcels-sync-launchd.sh` | Launchd-oriented wrapper that prevents duplicate parcel sync starts and then executes `bun run sync:parcels`. |

## Operational vs development-only surfaces

### Production and setup commands

Treat these as the real operational path:

- `bun run init:parcels-schema`
- `bun run sync:hyperscale`
- `bun run sync:parcels`
- `bun run load:parcels-canonical`
- `bun run tiles:build:parcels`
- `bun run tiles:publish:parcels`
- `bun run tiles:rollback:parcels`
- `bash scripts/run-parcels-sync-launchd.sh`

### Development-only commands

These commands are useful for local iteration and operator UI work, but they are not the production workflow:

- `bun run dev:api:sync-worker`
- `bun run dev:pipeline-monitor`
- the rest of the root `dev:*` scripts for app development

`dev:api:sync-worker` runs the same bounded-context sync services inside a watched Bun process, but the actual production path described in this page is the repo’s explicit scripts and scheduler wrapper, not a dev server.

## Run artifacts operators should watch

The parcel workflow is easiest to follow by watching the on-disk artifacts that the scripts write while they advance the run.

| Artifact | Writer | Why it matters |
| --- | --- | --- |
| `var/parcels-sync/active-run.json` | `scripts/refresh-parcels.sh` and `scripts/load-parcels-canonical.sh` | Current phase heartbeat for extraction, loading, building, publishing, completion, or failure. |
| `var/parcels-sync/latest.json` | `scripts/refresh-parcels.ts` | Latest extracted run pointer, including the summary, metadata, and run-config paths for the newest completed extraction. |
| `var/parcels-sync/<RUN_ID>/run-config.json` | `scripts/refresh-parcels.ts` | Saved extraction inputs so resume runs fail fast if the runtime flags changed. |
| `var/parcels-sync/<RUN_ID>/state-*.checkpoint.json` | `scripts/refresh-parcels.ts` | Per-state extraction checkpoints used for resume and incomplete-run recovery. |
| `var/parcels-sync/<RUN_ID>/run-summary.json` | `scripts/refresh-parcels.ts` | Completed extraction summary with `minimumAcres`, `stateConcurrency`, `pageSize`, and per-state counts. |
| `var/parcels-sync/<RUN_ID>/layer-metadata.json` | `scripts/refresh-parcels.ts` | Source layer metadata that the tile build can reuse for schema-aware PMTiles output. |
| `var/parcels-sync/<RUN_ID>/db-stage-complete.json` | `scripts/load-parcels-canonical.sh` | Marker proving the raw stage table was loaded for this run and can be reused safely. |
| `var/parcels-sync/<RUN_ID>/load-complete.json` | `scripts/refresh-parcels.sh` | Marker that canonical load and table swap finished. |
| `var/parcels-sync/<RUN_ID>/tile-build-complete.json` | `scripts/refresh-parcels.sh` | Marker that PMTiles build finished, including the dataset and artifact path. |
| `var/parcels-sync/<RUN_ID>/publish-complete.json` | `scripts/refresh-parcels.sh` | Marker that manifest publish completed. |
| `var/parcels-sync/postextract-<RUN_ID>.log` | `scripts/refresh-parcels.sh` | Tile-build log used by the API status parser and runbook triage. |
| `.cache/tiles/parcels-draw-v1/parcels-draw-v1_<RUN_ID>.pmtiles` | `scripts/build-parcels-draw-pmtiles.sh` | The built PMTiles artifact before publish. |
| `apps/web/public/tiles/parcels-draw-v1/latest.json` | `scripts/publish-parcels-manifest.ts` or `scripts/rollback-parcels-manifest.ts` | The live publish pointer the web app uses to load the current parcel tileset. |

## Current production flow

The primary path is `bun run sync:parcels`. That wrapper is authoritative because it stitches together every parcel phase and records phase markers as it goes.

### 0. One-time schema setup

Run this before the first load on a database or whenever the canonical parcel schema needs to be recreated:

```bash
bun run init:parcels-schema
```

`scripts/init-parcels-schema.sh` fails fast unless `DATABASE_URL` or `POSTGRES_URL` is available, then applies `scripts/sql/parcels-canonical-schema.sql` through `psql`.

### 1. Optional upstream sync before parcel work

The repo also has a separate sync path for mirrored hyperscale inputs:

```bash
bun run sync:hyperscale
```

`scripts/refresh-hyperscale.sh` is not part of the parcel-draw PMTiles loop, but it is part of the repo-level operational inventory. It mirrors specific hyperscale tables from the external MySQL source, rebuilds the spatial schema in Postgres, refreshes `serve.hyperscale_site`, and updates mirror-sync checkpoints. Treat it as an adjacent sync workflow, not as a fallback for parcel ingestion.

### 2. Parcel extraction and resume-safe snapshot creation

```bash
bun run sync:parcels
```

`scripts/refresh-parcels.sh` is the top-level parcel wrapper. Its extraction phase:

- requires `ARCGIS_PARCEL_CLIENT_ID` and `ARCGIS_PARCEL_CLIENT_SECRET`
- creates or resumes a `RUN_ID` under `var/parcels-sync`
- verifies the saved `run-config.json` when resuming
- delegates extraction to `scripts/refresh-parcels.ts`
- writes `active-run.json` with `phase: "extracting"`

`scripts/refresh-parcels.ts` then performs the actual ArcGIS/Regrid extraction:

- validates the upstream layer metadata and refuses blocked providers
- persists `run-config.json` so resume runs can detect mismatched inputs
- writes `layer-metadata.json` for downstream tile builds
- prefetches expected counts per state
- writes one checkpoint file per state as pages are fetched
- writes `run-summary.json` only when the extraction completes cleanly
- updates `var/parcels-sync/latest.json` to point at the newly completed extraction

The production resume behavior is deliberate. If a prior run exists and `PARCEL_SYNC_RESUME=1`, the wrapper will reuse the newest in-progress `RUN_ID` unless the saved config no longer matches the current flags.

### 3. Canonical load and swap

If extraction produced `run-summary.json`, the wrapper advances automatically into the database load:

```bash
RUN_ID=<run-id>
bash scripts/load-parcels-canonical.sh "var/parcels-sync/$RUN_ID" "$RUN_ID"
```

Use the direct load command when extraction has already completed and only the load phase needs to be retried.

The load script does four distinct things:

1. Re-applies `scripts/sql/parcels-canonical-schema.sql` so the base schemas exist.
2. Stages the NDJSON or JSONL extraction files into an unlogged raw table under `parcel_build`.
3. Materializes `parcel_build.parcels` from the staged ArcGIS features, validating row counts and creating the final geometry and indexes.
4. Promotes `parcel_build.parcels` into `parcel_current.parcels` under an advisory lock, archiving the previous current table into `parcel_history`.

Important load details that matter operationally:

- `db-stage-complete.json` lets the script reuse a previously staged raw table for the same `RUN_ID`.
- `active-run.json` stays in `phase: "loading"` and exposes detailed `db-load:*` summaries while staging, indexing, materializing, and swapping.
- the script records `parcel_meta.ingestion_runs` metadata after the swap completes
- the wrapper writes `load-complete.json` only after the load command exits cleanly

### 4. PMTiles build

After the canonical table swap, the wrapper builds the draw tiles:

```bash
RUN_ID=<run-id>
bash scripts/build-parcels-draw-pmtiles.sh "$RUN_ID"
```

This script reads directly from `parcel_current.parcels` and writes build artifacts under `.cache/tiles/parcels-draw-v1/`.

The current build path:

- enforces `psql`, `tippecanoe`, `pmtiles`, and `jq`
- creates a per-run build lock so the same run ID cannot build twice concurrently
- writes a tile schema snapshot JSON alongside the artifacts
- exports GeoJSONL from Postgres, then builds MBTiles with retry logic
- converts MBTiles to PMTiles with retry logic
- reuses `layer-metadata.json` from the extraction run when the selected profile needs schema awareness

The wrapper captures the build log in `var/parcels-sync/postextract-<RUN_ID>.log`, updates `active-run.json` with `phase: "building"`, and writes `tile-build-complete.json` only after the `.pmtiles` output exists.

### 5. Manifest publish

If the PMTiles artifact exists, the wrapper publishes it:

```bash
bun run tiles:publish:parcels
```

`scripts/publish-parcels-manifest.ts` resolves the PMTiles input from either explicit CLI flags or the latest parcel run, computes a SHA-256 checksum, copies the PMTiles artifact into `apps/web/public/tiles/parcels-draw-v1/<version>.pmtiles`, and writes `apps/web/public/tiles/parcels-draw-v1/latest.json`.

The live manifest format comes from `packages/geo-tiles/src/index.ts`:

- `current` points at the active artifact
- `previous` retains the prior published entry when one exists
- `publishedAt`, checksum, dataset, version, and optional `ingestionRunId` are validated before use

If the checksum already matches the current manifest, publish becomes a no-op instead of rewriting the manifest.

### 6. Rollback

Rollback is a manifest operation, not a rebuild:

```bash
bun run tiles:rollback:parcels
```

`scripts/rollback-parcels-manifest.ts`:

- loads the current `latest.json`
- refuses to proceed if `previous` is missing
- refuses to proceed if the previous PMTiles artifact is not present on disk
- swaps the manifest so `previous` becomes `current`
- preserves the rolled-back entry as the new `previous`

Use rollback when the tile artifact was published successfully but should no longer be the live parcel dataset. Do not use it to repair extraction or canonical-load failures.

There is a scripted publish rollback, but there is not a matching scripted database rollback command in this workflow. The database-side safety net is the archived `parcel_history.parcels_prev_<timestamp>` table created during the canonical swap.

## Command-level guidance

### Full production path

Use this when the repo needs the complete parcel refresh:

```bash
bun run init:parcels-schema
bun run sync:parcels
```

The wrapper will extract, load, build, and publish in order, skipping only phases that already have complete markers for the same `RUN_ID`.

### Re-run only the canonical load

Use this when extraction succeeded but the serving-table swap needs another pass:

```bash
RUN_ID=<run-id>
bun run load:parcels-canonical "var/parcels-sync/$RUN_ID" "$RUN_ID"
```

### Rebuild tiles without extracting again

Use this when `parcel_current.parcels` is already correct and only the tile artifact needs to be rebuilt:

```bash
RUN_ID=<run-id>
bun run tiles:build:parcels "$RUN_ID"
bun run tiles:publish:parcels -- --run-id="$RUN_ID"
```

### Scheduled execution

`scripts/run-parcels-sync-launchd.sh` is the scheduler-facing wrapper. It prevents duplicate `refresh-parcels.ts` processes, sets sane defaults such as `PARCEL_SYNC_MIN_ACRES`, `PARCEL_SYNC_RESUME`, and `PARCEL_SYNC_STATE_CONCURRENCY`, then executes `bun run sync:parcels`.

## How this workflow intersects the apps

- [API Runtime Foundations](/docs/applications/api-runtime): the API worker owns the long-running sync loops, and the parcel routes expose sync status plus coherency-sensitive parcel serving.
- [Pipeline Monitor](/docs/applications/pipeline-monitor): the monitor reads the same phase model the scripts write, including publish-state cues like `latest.json`.
- [Sync Architecture](/docs/data-and-sync/sync-architecture): use that page for the cross-app view of scripts, worker lifecycle, serving routes, and monitor surfaces.
- [Runbooks And Troubleshooting](/docs/operations/runbooks-and-troubleshooting): use that page for incident response once a phase has stalled or failed.

## Production-path rules

- Prefer the root script aliases over ad hoc shell fragments.
- Treat `sync:parcels` as the authoritative happy path; the individual phase commands are for targeted reruns or recovery.
- Use rollback only to move the live manifest pointer, not to repair upstream extraction or database-load mistakes.
- Do not introduce alternate fixture or legacy fallback flows into this workflow documentation. The repo already enforces a single production path for parcel serving.
