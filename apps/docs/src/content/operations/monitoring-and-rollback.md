---
title: Monitoring And Rollback
description: The runtime surfaces and commands operators should use when a parcel run is unhealthy, stale, or published with the wrong live manifest.
sources:
  - scripts/rollback-parcels-manifest.ts
  - scripts/publish-parcels-manifest.ts
  - scripts/run-parcels-sync-launchd.sh
  - apps/api/src/sync/parcels-sync/run-status-mutations.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline.view.ts
searchTerms:
  - rollback
  - monitoring
  - pipeline monitor
  - active run
---

This page is the shortest path through the repo when the parcel pipeline is unhealthy. It maps the monitoring and rollback surfaces to the actual commands and files you should inspect first.

## Monitoring surfaces

Use these surfaces in order:

1. the pipeline monitor for the normalized UI view
2. the API status snapshot for the transport-level truth
3. the on-disk sync files for raw phase and build details
4. the troubleshooting guide for next-step diagnosis and recovery

### Pipeline monitor

`apps/pipeline-monitor` is the fastest operator-facing view when you need to answer:

- what phase is the current run in
- whether the run is stale
- whether a tile build is still advancing
- what the latest summary or log tail says

### Worker-derived status

If the monitor looks wrong, inspect the worker reconciliation layer in `run-status-mutations.service.ts`. That is the code that decides whether a run is:

- active
- stale
- completed
- failed

### Raw files

When you need lower-level proof, inspect:

- `var/parcels-sync/active-run.json`
- `var/parcels-sync/latest.json`
- run-specific `run-summary.json`
- run-specific state checkpoints
- build logs and publish markers

## Rollback boundary

Manifest rollback is intentionally narrow. The repo’s supported rollback command is:

```bash
bun run tiles:rollback:parcels
```

That command only changes which published PMTiles file is live. It does not reverse extraction or database load work.

## When rollback is the right tool

Rollback is appropriate when:

- the PMTiles file was published successfully
- the manifest advanced
- the live dataset should no longer be current
- the previous file still exists on disk

Rollback is not the right tool when:

- extraction failed before publish
- canonical load failed
- build never produced a valid PMTiles file
- the previous published file is unavailable

## Scheduler and liveness

`scripts/run-parcels-sync-launchd.sh` is the scheduler-oriented entrypoint. It exists so automated execution does not launch duplicate parcel runs.

That matters operationally because duplicate starts can make status diagnosis misleading even when the UI itself is correct.

## Recommended incident reading path

1. [Troubleshooting And Recovery](/docs/operations/troubleshooting-and-recovery)
2. [Parcels Sync Status And Files](/docs/data-and-sync/parcels-sync-status-and-files)
3. [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows)
4. [Pipeline Monitor](/docs/applications/pipeline-monitor)

## Decision table

| Situation | First action |
| --- | --- |
| UI looks stale or phase is unclear | inspect the pipeline monitor, then the worker-derived status snapshot |
| extraction appears stalled | inspect `active-run.json`, checkpoints, and the troubleshooting guide |
| build appears stalled | inspect build-progress snapshots and the postextract log |
| wrong parcel tiles are live | use manifest rollback if the previous file is still present |
| database state looks wrong | use the troubleshooting guide and canonical-load workflow, not manifest rollback |
