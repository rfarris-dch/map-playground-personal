# Spatial Analysis Ops Runbook

## Scope
- Parcels ingestion + canonical load + tile build + publish.
- API coherency between tile manifest and parcel detail.
- CDC drift for MySQL write-of-record mirrors.

## Service-Level Targets
- API availability target: `99.9%` monthly.
- Tile manifest/PMTiles availability target: `99.95%` monthly.
- Publish lag target (extract start -> manifest published): `p95 < 6h`.
- Coherency target: `INGESTION_RUN_MISMATCH` persistent failures near zero after UI retry.

## Global Triage Inputs
- Run id and request id.
- Current sync status: `GET /api/parcels/sync/status`.
- Active marker: `var/parcels-sync/active-run.json`.
- Post-extract log: `var/parcels-sync/postextract-${RUN_ID}.log`.

## Runbook: Stalled Extraction
### Symptoms
- Sync status remains in `extracting`.
- `active-run.json.updatedAt` is not changing while `isRunning=true`.

### Checks
```bash
cat var/parcels-sync/active-run.json
curl -H "x-request-id: ops-$(date +%s)" http://localhost:3001/api/parcels/sync/status
```

### Actions
```bash
RUN_ID=<run-id> bash scripts/refresh-parcels.sh --run-id="$RUN_ID"
```

### Exit Criteria
- Phase transitions to `loading`.
- Or `failed` with clear summary and actionable error.

## Runbook: Failed Canonical Load
### Symptoms
- Phase stays on `loading`.
- `db-load:*` step appears stuck or failed.

### Checks
```bash
tail -n 200 var/parcels-sync/active-run.json
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM parcel_build.parcels;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM parcel_build.parcels_stage_raw;"
```

### Actions
```bash
RUN_ID=<run-id>
bash scripts/load-parcels-canonical.sh "var/parcels-sync/$RUN_ID" "$RUN_ID"
```

### Exit Criteria
- `swap-current` completed.
- `parcel_meta.ingestion_runs` contains successful row for `run_id`.

## Runbook: Failed Tile Build
### Symptoms
- Phase transitions to `building` then `failed`.
- No `PMTILES_PATH` in post-extract log.

### Checks
```bash
RUN_ID=<run-id>
tail -n 200 "var/parcels-sync/postextract-${RUN_ID}.log"
command -v tippecanoe pmtiles psql jq
ls -la .cache/tiles/parcels-draw-v1/*"${RUN_ID}"*.build.lock
```

### Actions
- Resolve missing dependencies or stale lock ownership.
- Re-run refresh for the same run id after issue is fixed.

### Exit Criteria
- PMTiles file produced.
- Manifest publish step succeeds.

## Runbook: API 409 Ingestion Mismatch Loop
### Symptoms
- Parcel detail returns `INGESTION_RUN_MISMATCH`.
- UI repeatedly fails parcel detail after selecting parcels.

### Checks
```bash
jq -r '.current.ingestionRunId' apps/web/public/tiles/parcels-draw-v1/latest.json
curl "http://localhost:3001/api/parcels/<parcel-id>" | jq -r '.feature.lineage.ingestionRunId'
```

### Actions
- Republish/rollback manifest so web manifest run id matches API lineage.
- Purge CDN cache for `latest.json` only.
- Ask user to retry detail fetch.

### Exit Criteria
- Manifest run id equals API lineage run id.
- 409 error rate returns to baseline.

## Runbook: CDC Drift (MySQL -> PostGIS Read Copy)
### Symptoms
- `saved_views`, `entitlements`, or model rows mismatch between stores.

### Checks
- Compare row counts and `updated_at` max timestamps.
- Check CDC consumer lag and dead-letter logs.

### Actions
- Restart CDC consumer if down.
- Backfill changed rows by primary key window.
- Enable drift alert if missing.

### Exit Criteria
- Row counts converge.
- CDC lag below threshold.

## Recovery and Rollback
- Keep at least two prior PMTiles publishes.
- Keep `latest.json` with both `current` and `previous`.
- Rollback path: point `latest.json.current` to prior version and invalidate only manifest cache.

## Alerting Rules
- No active marker update for `>10m` while running.
- Sync loop missed heartbeat by `>2x` interval.
- `failed` phase entered.
- API `503` rate above threshold on parcel/facility endpoints.
- API `409 INGESTION_RUN_MISMATCH` rate spike.
