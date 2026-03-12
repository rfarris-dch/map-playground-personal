# Sync Pipeline And Operator Surfaces

## Goal

Review the parcel-sync and operator path as one end-to-end operational system. The main question is whether the sync worker, scripts, status model, and pipeline monitor form one legible production path or a spread of partially-overlapping mechanisms.

## Area snapshot

- `apps/api/src/sync`: about 22 files and ~2978 lines
- `apps/pipeline-monitor/src/features/pipeline`: about 27 files and ~3562 lines
- scripts and tile publication entrypoints at the repo root

## Start here

- `apps/api/src/sync-worker.ts`
- `apps/api/src/sync`
- `apps/api/src/geo/parcels/route/parcels-sync-status.route.ts`
- `apps/pipeline-monitor/src/features/pipeline`
- `scripts/refresh-parcels.sh`
- `scripts/load-parcels-canonical.sh`
- `scripts/build-parcels-draw-pmtiles.sh`
- `scripts/publish-parcels-manifest.ts`
- `scripts/rollback-parcels-manifest.ts`
- `apps/docs/src/content/data-and-sync/sync-architecture.md`
- `apps/docs/src/content/operations/parcel-and-tile-workflows.md`
- `apps/docs/src/content/operations/monitoring-and-rollback.md`
- `apps/docs/src/content/operations/troubleshooting-and-recovery.md`
- `apps/docs/src/content/applications/pipeline-monitor.md`

## Main questions

- Is there one authoritative sync state machine?
- Is there one authoritative source for progress, status, and log-tail semantics?
- Are scripts thin operational entrypoints, or do they duplicate business rules that also exist in TypeScript services?
- Is the worker runtime explicit enough that an operator can reason about failures without reading source code in five folders?
- Is the pipeline monitor a read model only, or is it compensating for ambiguity in the sync runtime?
- Are publish and rollback semantics simple and deterministic?

## Operational prompts

- Trace one full parcel run from script to status store to HTTP route to pipeline monitor.
- Check whether run status mutation logic is centralized.
- Check whether progress parsing and tile-build parsing are cohesive or fragmented.
- Check whether filesystem protocol, manifest protocol, and UI protocol are aligned.
- Check whether sync configuration lives in one obvious place.

## Simplicity prompts

- Look for duplicate phase names, status semantics, or progress calculations.
- Look for monitor-side logic that should really live in the API or worker.
- Look for worker-side parsing code that should be simplified or collapsed.
- Look for scripts whose differences are mostly argument wiring and could be reduced.
- Look for publish and rollback code that can be made more intention-revealing.

## Legacy-context prompts

- The DatacenterHawk notes stress that admin and operational workflows are usually the hardest part of migration.
- Simplicity here means a single understandable runbook and a single production path.
- Avoid "simple" recommendations that actually hide failure modes or operator checkpoints.

## Deliverables for this pass

- a single narrative of the operational path
- a list of the true source-of-truth files
- a list of duplicated state or parsing logic
- a list of scripts or services to merge, shrink, or move
- the top reasons this area is currently harder to reason about than it should be

## What not to do

- Do not flatten scripts, worker code, and operator UI into one module.
- Do not keep UI-side compensation logic if runtime truth can be made clearer upstream.
- Do not recommend more layers if the current issue is already too much choreography.
