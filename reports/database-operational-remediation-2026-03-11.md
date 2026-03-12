# Database Operational Remediation Report

Date: 2026-03-11
Database: `dch_os`
Scope: targeted follow-up to the post-cleanup review covering planner stats, flood publication, parcel history, boundary publication ownership, and county-score contract clarity

## What This Report Covers

This report is written for a reader who does not have direct database access.

It records the concrete follow-up work applied after the structural cleanup, organized by the bounded contexts those changes affect:

- `parcel sync` and `parcels`
- `flood`
- `boundaries`
- `markets`
- `county scores`

It should be read alongside:

- `reports/database-comprehensive-state-2026-03-11.md`
- `reports/database-normalization-cleanup-2026-03-11.md`
- `reports/database-audit-report-2026-03-11.md`

## Executive State

The database no longer has the earlier structural problems around `mirror`, `legacy`, project-owned partitioned tables, or mixed-case relation names.

The follow-up work in this pass focused on operational correctness:

- refreshed planner statistics on the active hot tables that were still showing stale or missing estimates
- added explicit parcel-history retention and removed nonessential archive indexes from retained parcel-history tables
- added a canonical repo-owned county-boundary refresh path with publication verification metadata
- wired the market-boundary refresh wrapper to refresh published county boundaries first
- updated the flood publish script so the serving table is analyzed at the end of publication

The only item that was still actively executing when this report was written was the flood publication transaction already in flight on the database. That worker was actively consuming CPU and writing WAL, which means the publication was running rather than idle or blocked by planner drift.

## 1. Planner Stats Hygiene

Affected bounded contexts:

- `parcels`
- `facilities`
- `boundaries`

Problem state before remediation:

- `parcel_current.parcels`
- `serve.facility_site`
- `serve.hyperscale_site`
- `serve.admin_county_geom_lod0`
- `serve.admin_county_geom_lod1`
- `serve.admin_county_geom_lod2`
- `serve.admin_county_geom_lod3`

were all carrying stale or missing planner statistics in `pg_stat_user_tables`.

Changes applied:

- ran `ANALYZE parcel_current.parcels`
- ran `ANALYZE serve.facility_site`
- ran `ANALYZE serve.hyperscale_site`
- ran `ANALYZE serve.admin_county_geom_lod0`
- ran `ANALYZE serve.admin_county_geom_lod1`
- ran `ANALYZE serve.admin_county_geom_lod2`
- ran `ANALYZE serve.admin_county_geom_lod3`
- ensured the copied county boundary tables are analyzed during their refresh path
- added table-level autovacuum analyze settings on `parcel_current.parcels`

Current parcel analyze settings:

```text
autovacuum_analyze_scale_factor = 0.02
autovacuum_analyze_threshold = 5000
```

Observed post-remediation stats timestamps:

- `parcel_current.parcels` analyzed at `2026-03-11 13:20:33 -05`
- `serve.facility_site` analyzed at `2026-03-11 13:20:44 -05`
- `serve.hyperscale_site` analyzed at `2026-03-11 13:20:44 -05`
- `serve.admin_county_geom_lod0..3` analyzed at `2026-03-11 13:20:44 -05`
- `serve.boundary_county_geom_lod1..3` analyzed during the county-boundary publication refresh at `2026-03-11 13:18 -05`

Repo changes backing this:

- [load-parcels-canonical.sh](/Users/robertfarris/map/scripts/load-parcels-canonical.sh)
- [refresh-county-boundaries.sql](/Users/robertfarris/map/scripts/sql/refresh-county-boundaries.sql)
- [refresh-environmental-flood.ts](/Users/robertfarris/map/scripts/refresh-environmental-flood.ts)

## 2. Flood Publication Path

Affected bounded contexts:

- `flood`
- `analysis summary`

Live state at the start of this pass:

- `environmental_build.flood_hazard_stage` contained `4,394,498` rows
- `environmental_current.flood_hazard` contained `0` visible rows
- `environmental_meta.flood_runs` contained `1` run record

That meant the flood dataset had reached staging and provenance recording, but not yet a visible serving-table publish.

Repo changes applied:

- the flood publish script now ends with:
  - `ANALYZE environmental_meta.flood_runs`
  - `ANALYZE environmental_current.flood_hazard`

Source of truth for the publish path:

- [refresh-environmental-flood.ts](/Users/robertfarris/map/scripts/refresh-environmental-flood.ts)
- [environmental-flood-schema.sql](/Users/robertfarris/map/scripts/sql/environmental-flood-schema.sql)
- [flood.service.ts](/Users/robertfarris/map/apps/api/src/geo/flood/flood.service.ts)
- [analysis-summary.repo.ts](/Users/robertfarris/map/apps/api/src/geo/analysis-summary/analysis-summary.repo.ts)

Runtime note:

At report time, a database transaction owned by user `dch` was actively executing the flood publication INSERT path against `environmental_current.flood_hazard`. It had been running for more than twelve minutes and was still CPU-active, so the publication work was in progress rather than abandoned.

## 3. Parcel History Retention And Archive Index Policy

Affected bounded contexts:

- `parcel sync`
- `parcels`

Live state before remediation:

- parcel history had accumulated multiple `parcel_history.parcels_prev_*` tables
- several retained history tables carried duplicated logical secondary indexes on `geoid` and `state2`
- some history tables also carried `source_oid` secondary indexes even though those tables are archival snapshots rather than the active serving path

Changes applied to the database:

- pruned parcel history down to the newest `3` archived publish snapshots
- removed every non-primary, non-`geom_3857` index from the retained parcel-history tables

Retained parcel-history tables now present:

- `parcel_history.parcels_prev_20260302132959`
- `parcel_history.parcels_prev_20260302133713`
- `parcel_history.parcels_prev_20260303235240`

Retained index policy now present on those tables:

- primary key on `parcel_id`
- GiST index on `geom_3857`
- no `geoid`
- no `state2`
- no `source_oid`

Repo changes backing this:

- [load-parcels-canonical.sh](/Users/robertfarris/map/scripts/load-parcels-canonical.sh)

That script now:

- drops nonessential secondary indexes from the just-archived parcel snapshot during publish
- analyzes `parcel_current.parcels` immediately after the swap
- prunes parcel history to the newest `3` snapshots after the swap

## 4. County Boundary Publication Ownership

Affected bounded contexts:

- `boundaries`
- `markets`
- `analysis summary`

State before remediation:

- `serve.boundary_county_geom_lod1`
- `serve.boundary_county_geom_lod2`
- `serve.boundary_county_geom_lod3`

were regular tables, but they did not yet have a canonical repo-owned refresh path or publication audit metadata.

Changes applied:

- added a dedicated refresh SQL path:
  - [refresh-county-boundaries.sql](/Users/robertfarris/map/scripts/sql/refresh-county-boundaries.sql)
- added a shell entrypoint:
  - [refresh-county-boundaries.sh](/Users/robertfarris/map/scripts/refresh-county-boundaries.sh)
- added publication audit table:
  - `serve.boundary_county_publication`
- added row-count and dataset-hash verification between each `serve.admin_county_geom_lod*` source relation and its `serve.boundary_county_geom_lod*` published copy
- added table comments on the published boundary tables pointing back to the canonical refresh entrypoint
- updated the market-boundary refresh wrapper so it refreshes county-boundary publications before rebuilding market boundaries

Current publication audit rows:

```text
serve.boundary_county_geom_lod1 <- serve.admin_county_geom_lod1 rows=3221 refreshed_at=2026-03-11 13:17:33 -05
serve.boundary_county_geom_lod2 <- serve.admin_county_geom_lod2 rows=3221 refreshed_at=2026-03-11 13:17:33 -05
serve.boundary_county_geom_lod3 <- serve.admin_county_geom_lod3 rows=3221 refreshed_at=2026-03-11 13:17:33 -05
```

Repo changes backing this:

- [refresh-county-boundaries.sql](/Users/robertfarris/map/scripts/sql/refresh-county-boundaries.sql)
- [refresh-county-boundaries.sh](/Users/robertfarris/map/scripts/refresh-county-boundaries.sh)
- [refresh-market-boundaries.sh](/Users/robertfarris/map/scripts/refresh-market-boundaries.sh)

## 5. County-Score Contract Clarity

Affected bounded contexts:

- `county scores`
- `analysis summary`

Live state observed in this pass:

- `analytics.county_market_pressure_current` had `3,221` rows
- `analytics.fact_market_analysis_score_snapshot` had `6,442` rows
- `analytics.fact_narrative_snapshot` had `6,442` rows
- `analytics.fact_publication` had `2` rows
- `analytics.fact_gas_snapshot` was empty
- `analytics.fact_gen_queue_project` was empty
- `analytics.fact_gen_queue_snapshot` was empty
- `analytics.fact_generation_realized_snapshot` was empty
- `analytics.fact_grid_friction_snapshot` was empty
- `analytics.fact_policy_event` was empty
- `analytics.fact_policy_snapshot` was empty

What governs the county-score contract in this repo:

- the publication contract is not implicit in the presence of all `analytics.fact_*` tables
- it is explicitly materialized into `analytics.fact_publication.available_feature_families`
- and `analytics.fact_publication.missing_feature_families`

That contract is produced by:

- [refresh-county-scores.sql](/Users/robertfarris/map/scripts/sql/refresh-county-scores.sql)

This means the active county-score product already has a repo-owned way to record which feature families are present and which are absent for a given publication run.

## 6. Bounded-Context Summary

The review items in this pass were not random database tuning work. They map directly back to active repo contexts:

- `parcel sync`: publish, archive, rollback window, parcel-table stats
- `parcels`: live parcel-serving table planner health
- `flood`: stage-to-current publication correctness and serving-table stats
- `boundaries`: published county geometry ownership, verification, and auditability
- `markets`: dependence on county boundary publications for derived market boundaries
- `county scores`: publication semantics for feature-family presence vs empty placeholder fact tables

## File Changes In This Pass

- [load-parcels-canonical.sh](/Users/robertfarris/map/scripts/load-parcels-canonical.sh)
- [refresh-environmental-flood.ts](/Users/robertfarris/map/scripts/refresh-environmental-flood.ts)
- [refresh-county-boundaries.sql](/Users/robertfarris/map/scripts/sql/refresh-county-boundaries.sql)
- [refresh-county-boundaries.sh](/Users/robertfarris/map/scripts/refresh-county-boundaries.sh)
- [refresh-market-boundaries.sh](/Users/robertfarris/map/scripts/refresh-market-boundaries.sh)

## Database Changes In This Pass

- analyzed hot serving tables that still had stale planner stats
- set explicit analyze thresholds on `parcel_current.parcels`
- pruned parcel-history snapshots down to three retained tables
- removed nonessential secondary indexes from retained parcel-history tables
- created `serve.boundary_county_publication`
- refreshed and verified all `serve.boundary_county_geom_lod*` published county-boundary tables

## Verification Snapshot

Verified directly from the live database during this pass:

- `parcel_current.parcels` now has fresh analyze stats
- `serve.facility_site` now has fresh analyze stats
- `serve.hyperscale_site` now has fresh analyze stats
- `serve.admin_county_geom_lod0..3` now have fresh analyze stats
- `serve.boundary_county_geom_lod1..3` have publication-audit records and refreshed stats
- `parcel_history` now retains exactly `3` `parcels_prev_*` tables
- retained parcel-history tables now keep only the PK and `geom_3857` GiST index

Flood publication remained actively in progress at report time and therefore was recorded as an in-flight remediation item rather than misreported as already visible in `environmental_current.flood_hazard`.
