---
title: Runbooks And Troubleshooting
description: Operational recovery entry points for parcel sync, tile publish, coherency, and drift issues.
---

The current operational source of truth is `docs/runbooks/spatial-analysis-ops.md`. This page turns that file into a quick routing guide.

## Required triage inputs

Before acting, capture:

- run ID
- request ID
- current sync status from `GET /api/parcels/sync/status`
- `var/parcels-sync/active-run.json`
- the relevant `postextract-<RUN_ID>.log`

## Main failure modes

### Stalled extraction

Symptoms:

- run remains in `extracting`
- `active-run.json.updatedAt` stops moving while `isRunning=true`

Primary path:

```bash
RUN_ID=<run-id> bash scripts/refresh-parcels.sh --run-id="$RUN_ID"
```

### Failed canonical load

Symptoms:

- run remains in `loading`
- canonical load or swap step is stuck or failed

Primary path:

```bash
RUN_ID=<run-id>
bash scripts/load-parcels-canonical.sh "var/parcels-sync/$RUN_ID" "$RUN_ID"
```

### Failed tile build

Symptoms:

- phase enters `building` and then `failed`
- no `PMTILES_PATH` is written to the run log

First checks:

- verify `tippecanoe`, `pmtiles`, `psql`, and `jq`
- check for stale build locks
- inspect `postextract-<RUN_ID>.log`

### API and tile manifest mismatch

Symptoms:

- parcel detail returns `INGESTION_RUN_MISMATCH`
- the UI loops on parcel detail failures

Primary response:

- compare the manifest run ID with API lineage
- republish or roll back the manifest
- purge CDN cache for `latest.json`

### CDC drift

Symptoms:

- `saved_views`, entitlements, or model rows drift between stores

Primary response:

- compare row counts and `updated_at`
- inspect CDC lag
- backfill the affected key window if needed

## Exit-criteria mindset

Every runbook in this repo should end with an explicit stop condition, not vague “monitor it” language. The current runbook already follows that pattern and should remain the model.

## Related pages

- [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows)
- [API Runtime Foundations](/docs/applications/api-runtime)
- [Pipeline Monitor](/docs/applications/pipeline-monitor)
