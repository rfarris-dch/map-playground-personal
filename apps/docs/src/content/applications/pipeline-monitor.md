---
title: Pipeline Monitor
description: The separate Vue dashboard that polls parcel sync status, derives operator signals, and visualizes ingestion and publish progress.
sources:
  - apps/pipeline-monitor/package.json
  - apps/pipeline-monitor/src/main.ts
  - apps/pipeline-monitor/src/app.vue
  - apps/pipeline-monitor/src/features/pipeline/components/pipeline-dashboard.vue
  - apps/pipeline-monitor/src/features/pipeline/components/pipeline-dashboard/use-pipeline-dashboard.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline.view.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline-tracking/pipeline-tracking-history.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline-tracking/pipeline-tracking-live-event.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline-tracking/pipeline-tracking-live-sample.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline-tracking/pipeline-tracking-rate.service.ts
  - apps/pipeline-monitor/src/features/pipeline/pipeline-tracking/pipeline-tracking-build-rate.service.ts
  - apps/api/src/geo/parcels/route/parcels-sync-status.route.ts
  - apps/api/src/sync/parcels-sync/application/parcels-sync-status-query.service.ts
  - apps/api/src/sync/parcels-sync/status-store.service.ts
  - packages/contracts/src/api-contracts.ts
  - packages/contracts/src/parcels-contracts.ts
  - scripts/refresh-parcels.sh
  - scripts/load-parcels-canonical.sh
---

`apps/pipeline-monitor` is a dedicated Vue 3 + Vite operator surface for parcel pipeline monitoring. It is intentionally separate from `apps/web` so ingestion visibility does not depend on the map runtime, and it stays narrower than `apps/api` because it only reads the sync-status contract.

## Entrypoints and runtime shape

### Boot and package scripts

`apps/pipeline-monitor/package.json` keeps the app isolated with its own `dev`, `build`, `preview`, `lint`, and `typecheck` scripts. There is no shared runtime import from the other product apps.

The runtime entrypoints are intentionally small:

- `apps/pipeline-monitor/src/main.ts` creates the Vue app, imports the global stylesheet, and mounts `App`.
- `apps/pipeline-monitor/src/app.vue` renders the operator-facing page shell and mounts a single `PipelineDashboard` feature.

There is no router and no alternate page surface. The monitor is a single-screen operational client.

### Feature boundaries

The `features/pipeline` folder is the real application boundary:

- `components/pipeline-dashboard.vue` is the composition surface that wires the dashboard sections together.
- `components/pipeline-dashboard/use-pipeline-dashboard.ts` derives view-ready signals from the polling controller and keeps the route-level component thin.
- `pipeline.view.ts` is the long-lived polling controller. Despite the filename, it is not a `.vue` route. It owns refresh cadence, in-flight request cancellation, heartbeat timing, and bounded history/event buffers.
- `pipeline.service.ts` is the transport seam. It builds the request, stamps a request ID, validates the response against `ParcelsSyncStatusResponseSchema`, and normalizes a few raw completion flags for display correctness.
- `pipeline-tracking/*.ts` contains pure derivation services for live samples, event feed rows, row-rate estimates, tile-build-rate estimates, and time math.
- `components/pipeline-dashboard/*.service.ts` handles dashboard-specific parsing and display progress rules, such as decoding `db-load:*` summaries and keeping recently updated states at `99%` until completion is explicit.

This is a clean split for the monitor: `app.vue` shells the screen, `pipeline.view.ts` manages live state, `pipeline.service.ts` talks to the API contract, and the tracking services turn snapshots into operator signals.

## Dashboard surfaces

`PipelineDashboard` breaks the monitor into operator-focused panels rather than one monolithic table.

### Overview and polling health

- `pipeline-dashboard-overview.vue` shows feed health, current phase, run ID, row-rate estimate, ETA, last successful poll, polling interval, next poll time, request latency, success rate, and consecutive failure count.
- Auto-refresh is part of the surface, not hidden infrastructure. The controller polls every `3s` while a run is active and every `15s` when idle.
- The controller also keeps a `1s` heartbeat so relative ages, "next poll in", and stall windows continue updating between requests.

### Phase-specific progress panels

- `pipeline-dashboard-progress-panels.vue` always shows state completion and row completion.
- During `loading`, it parses structured or summary-string progress into database-load step labels, file counts, active workers, materialization state, and a percent bar.
- During `building`, it parses build percent, stage, work units, build-log size, build ETA, and "no recent movement" warnings.
- During `publishing`, it switches to a publish-status panel so operators can distinguish PMTiles conversion from manifest publication.

### Detail, events, and raw tails

- `pipeline-dashboard-details-panels.vue` exposes run metadata such as reason, timestamps, duration, exit code, summary, sync mode, interval, and snapshot root.
- `pipeline-dashboard-state-events.vue` renders the per-state checkpoint table and the derived live event feed.
- `pipeline-dashboard-log-tail.vue` shows the captured tail of the run log so an operator can correlate the status model with the most recent script output.
- `pipeline-dashboard-fetch-error-alert.vue` and `pipeline-dashboard-alerts.vue` surface transport failures, partial-state coverage warnings, and the "no active sync run" case directly in the screen.

## What data the monitor reads

The monitor does not read local files directly. Its authoritative input is `GET /api/geo/parcels/sync/status`, requested through `buildParcelsSyncStatusRoute()` from `@map-migration/contracts`.

`pipeline.service.ts` adds `x-request-id`, then validates the JSON body with `ParcelsSyncStatusResponseSchema`. The contract gives the UI one stable payload shape:

- top-level sync configuration: `enabled`, `mode`, `intervalMs`, `requireStartupSuccess`, `latestRunId`, `latestRunCompletedAt`
- run lifecycle metadata: `runId`, `phase`, `reason`, `startedAt`, `endedAt`, `durationMs`, `exitCode`, `summary`
- per-state checkpoint rows: `state`, `writtenCount`, `expectedCount`, `pagesFetched`, `lastSourceId`, `updatedAt`, `isCompleted`
- optional deeper progress details: `progress.dbLoad` and `progress.tileBuild`
- recent log context: `logTail`

The API route in `apps/api/src/geo/parcels/route/parcels-sync-status.route.ts` is the real data boundary. It can redact internals such as `snapshotRoot`, `summary`, `logTail`, `currentFile`, and `activeWorkers` when sync internals are not meant to be exposed. The monitor is written to tolerate that by treating many detail fields as optional and falling back to `n/a` instead of assuming debug visibility.

## What states it visualizes

At the highest level, the monitor tracks the parcel run phases already used across the repo:

- `idle`
- `extracting`
- `loading`
- `building`
- `publishing`
- `completed`
- `failed`

The app does more than label the current phase. It derives operator-facing state from successive status snapshots:

- live feed tone: `Connecting`, `Live`, `Degraded`, or stall-oriented warning states
- row throughput and ETA from recent and average row movement
- tile-build throughput and ETA from percent and log-growth movement during the `building` phase
- likely-stalled signals when row or build movement stops for longer than a polling-based threshold
- state completion percentages that stay just below `100%` when counts appear complete but the run has not yet marked the state as finished
- event feed entries for run changes, phase changes, row-count jumps, state-completion jumps, request failures, and recovery after failure streaks

That makes the monitor useful for answering two different questions:

- "What phase is the run in right now?"
- "Is the phase actually progressing, or has it just stopped updating?"

## How it relates to parcel sync and operations

The monitor is not the source of truth for parcel execution. It is the read model for the same operational path documented elsewhere in the repo.

### Upstream operational chain

1. [`scripts/refresh-parcels.sh`](/docs/operations/parcel-and-tile-workflows) advances the extract, load, build, publish, complete, and failure phases and writes the phase heartbeat under `var/parcels-sync`.
2. `apps/api` refreshes the parcels sync status store from the filesystem and exposes that status through the parcels sync route.
3. `apps/pipeline-monitor` polls that route and turns the snapshots into rates, events, warnings, and progress bars.

### API and worker seam

The monitor is closest to the parcel sync worker path, not to the general HTTP serving surface:

- `apps/api/src/sync/parcels-sync/status-store.service.ts` owns the mutable status snapshot, log-tail capture, and run finalization state.
- `apps/api/src/sync/parcels-sync/application/parcels-sync-status-query.service.ts` refreshes the store from disk before snapshotting it for HTTP reads.
- the HTTP route simply sanitizes and publishes that snapshot through the shared contract.

That means monitor regressions usually point to one of three places:

- the sync scripts stopped writing or updating the expected files
- the API status store stopped refreshing or sanitizing correctly
- the UI derivation logic misread the contract

## Position in the broader repo

`apps/pipeline-monitor` is the operator-facing read side of the parcel sync system:

- it does not trigger sync runs itself
- it does not own the parcel-serving API
- it does not own the live tile manifest
- it exists to make the sync state legible without reading `active-run.json`, `postextract-<RUN_ID>.log`, or database metadata by hand

This is why it belongs beside the sync and runbook docs instead of being buried inside the web runtime pages.

## Related docs

- Use [Sync Architecture](/docs/data-and-sync/sync-architecture) for the cross-app view that connects scripts, the sync worker, the API status route, and this UI.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) for the command-level production path and the on-disk artifacts this monitor is summarizing.
- Use [Runbooks And Troubleshooting](/docs/operations/runbooks-and-troubleshooting) when a stalled or failed phase needs an explicit recovery procedure.
- Use [API Runtime Foundations](/docs/applications/api-runtime) for the HTTP/runtime boundary that serves the status feed.
- Use [Contracts](/docs/packages/contracts) when changing the shared status schema or route builders that this app depends on.
