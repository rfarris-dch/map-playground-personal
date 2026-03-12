# Comprehensive Database State Report

Date: 2026-03-11
Database: `dch_os`
Scope: post-cleanup live catalog, object types, schema inventory, and index artifacts

## What This Report Is

This report is written for a reader who does not have direct database access.

It records:

- what was removed during cleanup
- what remains in the database now
- which schemas and tables are on the active repo path
- which schemas remain present but are not directly used by current runtime code
- the post-cleanup table catalog by schema

Supporting artifacts:

- `reports/db-relation-inventory-2026-03-11.tsv`
- `reports/db-index-inventory-2026-03-11.tsv`
- `reports/db-mirror-deleted-2026-03-11.tsv`
- `reports/database-operational-remediation-2026-03-11.md`
- `reports/database-audit-report-2026-03-11.md`
- `reports/database-normalization-cleanup-2026-03-11.md`

## Cleanup Completed

The database cleanup completed successfully.

Removed:

- all `mirror.*` tables
- the entire `legacy` schema
- `serve.parcel`
- `serve.parcel_default`
- `parcel_current.parcels_prev_20260302021414`

Converted to regular tables:

- `serve.boundary_county_geom_lod1`
- `serve.boundary_county_geom_lod2`
- `serve.boundary_county_geom_lod3`

Preserved:

- `parcel_current.parcels` with `24,575,367` rows
- all active serving, staging, analytics, and market schemas used by the current repo

## Current Object-Type State

Current non-system relation counts:

- `82` regular tables
- `0` partitioned tables
- `2` views
- `0` materialized views

The only remaining non-regular relations are PostGIS catalog views:

- `public.geometry_columns`
- `public.geography_columns`

All remaining relation names are lowercase.

## Active Repo Path

These relations are on the current repo runtime or maintained-script path:

- `serve.facility_site`
- `serve.hyperscale_site`
- `serve.boundary_county_geom_lod1`
- `serve.boundary_county_geom_lod2`
- `serve.boundary_county_geom_lod3`
- `facility_current.providers`
- `parcel_current.parcels`
- `environmental_current.flood_hazard`
- `market_current.market_boundaries`
- `market_current.markets`
- `market_source.*`
- `analytics.county_market_pressure_current`
- `analytics.dim_county`
- `analytics.fact_publication`
- `analytics.bridge_county_market`
- `analytics.bridge_county_adjacency`
- `analytics.fact_*` county-score snapshot and publication tables
- `environmental_build.flood_hazard_stage`
- `parcel_build.parcels_stage_raw`
- `parcel_meta.ingestion_runs`
- `parcel_meta.ingestion_checkpoints`
- `parcel_history.parcels_prev_*`
- `spatial.submarket_points`

## Bounded Contexts

This repository’s database is not one undifferentiated data store. The remaining schemas map to a set of bounded contexts that show up in the API slice structure, the docs IA, and the shared-package boundaries.

The main bounded contexts are:

- `boundaries`: power-boundary overlays and county/state/country geometry reads
- `facilities`: colocation and hyperscale facility map reads, table reads, and detail reads
- `markets`: market selection, market listing, and market-boundary serving
- `providers`: provider reporting and provider aggregation over facility-serving tables
- `parcels`: parcel detail, lookup, enrich, and parcel-serving policy
- `parcel sync`: parcel ingest, publish, lineage, and sync-status operations
- `flood`: environmental flood staging, provenance, API reads, and flood tile generation
- `county scores`: county-intelligence publication, rankings, narratives, and county-level analytics serving
- `analysis summary`: cross-domain summary composition that joins facilities, markets, counties, and flood
- `market source sync`: upstream market-source landing and refresh inputs
- `shared geo sql`: reusable query-spec package that defines query builders used by facilities and parcels
- `data and sync operations`: script-driven ingestion, refresh, publish, rollback, and monitoring seams that cross API and operational workflows

The repo’s own domain framing for this comes from:

- [api-geo-slices.md](/Users/robertfarris/map/apps/docs/src/content/applications/api-geo-slices.md)
- [api-boundaries-and-facilities.md](/Users/robertfarris/map/apps/docs/src/content/applications/api-boundaries-and-facilities.md)
- [api-fiber-markets-and-providers.md](/Users/robertfarris/map/apps/docs/src/content/applications/api-fiber-markets-and-providers.md)
- [api-parcels-and-sync.md](/Users/robertfarris/map/apps/docs/src/content/applications/api-parcels-and-sync.md)
- [README.md](/Users/robertfarris/map/README.md)

## Bounded Context To Schema Mapping

### `boundaries`

Repo surfaces:

- `apps/api/src/geo/boundaries`

Primary relations:

- `serve.boundary_county_geom_lod1`
- `serve.boundary_county_geom_lod2`
- `serve.boundary_county_geom_lod3`
- `serve.facility_site`
- `serve.hyperscale_site`

Supporting relations:

- `serve.admin_county_geom_lod0`
- `serve.admin_county_geom_lod1`
- `serve.admin_county_geom_lod2`
- `serve.admin_county_geom_lod3`

Role:

- serves map-ready power overlays at county, state, and country levels by combining facility-serving tables with county geometry

### `facilities`

Repo surfaces:

- `apps/api/src/geo/facilities`
- `packages/geo-sql`

Primary relations:

- `serve.facility_site`
- `serve.hyperscale_site`
- `facility_current.providers`

Supporting relations:

- `spatial.colo_facility_features`
- `spatial.colo_facility_points`
- `spatial.hyperscale_facility_features`
- `spatial.hyperscale_facility_points`
- `spatial.enterprise_facility_points`
- `serve.enterprise_site`

Role:

- owns map fetches, polygon selections, paginated facility tables, and detail records for colocation and hyperscale facilities

### `markets`

Repo surfaces:

- `apps/api/src/geo/markets`

Primary relations:

- `market_current.market_boundaries`
- `market_current.markets`

Supporting relations:

- `market_source.markets`
- `market_source.submarkets`
- `market_source.market_quarterly_data`
- `market_source.market_yearly_data`
- `market_source.market_totals_data`
- `market_source.market_updates`
- `market_source.market_cap_reports`
- `market_source.market_groups`
- `market_source.world_regions`
- `market_source.colocation_points`
- `market_source.hyperscale_points`
- `spatial.submarket_points`
- `analytics.bridge_county_market`

Role:

- owns market listing, market selection, and market-boundary refresh output

### `providers`

Repo surfaces:

- `apps/api/src/geo/providers`

Primary relations:

- `serve.facility_site`
- `serve.hyperscale_site`
- `facility_current.providers`

Role:

- owns provider reporting and aggregation over the facility-serving model

### `parcels`

Repo surfaces:

- `apps/api/src/geo/parcels`
- `packages/geo-sql`

Primary relations:

- `parcel_current.parcels`

Supporting relations:

- `parcel_build.parcels_stage_raw`
- `parcel_build.parcels_stage_raw_20260303t045507z`

Role:

- owns parcel detail, batch lookup, AOI enrichment, and parcel geometry access

### `parcel sync`

Repo surfaces:

- `apps/api/src/sync-worker.ts`
- `apps/api/src/sync/parcels-sync*`
- parcel operational scripts under `scripts/`

Primary relations:

- `parcel_meta.ingestion_runs`
- `parcel_meta.ingestion_checkpoints`
- `parcel_history.parcels_prev_*`
- `parcel_build.parcels_stage_raw`

Role:

- owns parcel ingestion lineage, checkpointing, archival publish history, and sync-status reporting

### `flood`

Repo surfaces:

- `apps/api/src/geo/flood`
- `scripts/refresh-environmental-flood.ts`
- `scripts/build-environmental-flood-pmtiles.sh`

Primary relations:

- `environmental_current.flood_hazard`
- `environmental_meta.flood_runs`
- `environmental_build.flood_hazard_stage`

Supporting relations:

- `environmental_build.flood_hazard_stage_probe`
- `environmental_build.flood_hazard_stage_probe2`
- `environmental_build.flood_hazard_stage_probe3`
- `environmental_build.flood_probe`

Role:

- owns environmental flood normalization, staging, publication provenance, API reads, and tile-build input

### `county scores`

Repo surfaces:

- `apps/api/src/geo/county-scores`
- `scripts/sql/refresh-county-scores.sql`

Primary relations:

- `analytics.county_market_pressure_current`
- `analytics.dim_county`
- `analytics.fact_publication`
- `analytics.fact_market_analysis_score_snapshot`
- `analytics.fact_narrative_snapshot`

Supporting relations:

- `analytics.bridge_county_adjacency`
- `analytics.bridge_county_market`
- `analytics.fact_dc_pipeline_project`
- `analytics.fact_dc_pipeline_snapshot`
- `analytics.fact_gen_queue_project`
- `analytics.fact_gen_queue_snapshot`
- `analytics.fact_generation_realized_snapshot`
- `analytics.fact_grid_friction_snapshot`
- `analytics.fact_policy_event`
- `analytics.fact_policy_snapshot`
- `analytics.fact_gas_snapshot`
- `analytics.country_metrics_v1`
- `analytics.county_metrics_v1`
- `analytics.county_scores_v1`
- `analytics.state_metrics_v1`
- `analytics_meta.county_score_publications`

Role:

- owns county-level intelligence, ranking, publication metadata, narratives, and county-derived demand/supply/policy/infrastructure aggregates

### `analysis summary`

Repo surfaces:

- `apps/api/src/geo/analysis-summary`

Primary relations:

- `serve.boundary_county_geom_lod1`
- `market_current.market_boundaries`
- `serve.facility_site`
- `environmental_current.flood_hazard`

Role:

- composes a cross-domain summary view over county boundaries, markets, facilities, and flood for map analysis panels

### `market source sync`

Repo surfaces:

- `scripts/sync-market-source.sh`
- `scripts/refresh-market-boundaries.sh`

Primary relations:

- all `market_source.*`

Role:

- lands upstream market-source records and feeds the market-current serving path

### `shared geo sql`

Repo surfaces:

- `packages/geo-sql`

Primary relations touched through query builders:

- `serve.facility_site`
- `serve.hyperscale_site`
- `facility_current.providers`
- `analytics.county_market_pressure_current`
- `parcel_current.parcels`

Role:

- shared query-spec boundary reused by facilities and parcels, with county-score reads also exposed from the package

### `data and sync operations`

Repo surfaces:

- `scripts/**`
- `apps/api/src/sync-worker.ts`
- `apps/pipeline-monitor/**`

Primary relations:

- `parcel_build.*`
- `parcel_meta.*`
- `parcel_history.*`
- `market_source.*`
- `market_current.*`
- `environmental_build.*`
- `environmental_current.*`
- `environmental_meta.*`
- `analytics.*`

Role:

- operational context spanning staging, refresh, publish, rollback, and sync-status workflows across multiple domain-specific schemas

## Present But Not Directly Read by Current Runtime

These schemas remain in the database but are not direct runtime read targets in the current app path:

- `analytics_meta`
- `norm`
- `ops`
- `raw`
- `search`
- `serve.admin_county_geom_lod0..3`
- `serve.enterprise_site`
- `spatial.colo_facility_features`
- `spatial.colo_facility_points`
- `spatial.enterprise_facility_points`
- `spatial.hyperscale_facility_features`
- `spatial.hyperscale_facility_points`
- `spatial.internet_exchange_points`

These may still matter operationally, historically, or for future work, but they are not the primary live query path exposed by the current repo.

## Schema Inventory

Row counts below are catalog-backed counts or planner statistics as observed at audit time. Sizes are on-disk sizes reported by PostgreSQL.

### `_tmpcopy`

Purpose:

- transient scratch relation

Catalog:

```text
t                                 regular table   rows=0         size=16 kB
```

### `analytics`

Purpose:

- county-score serving, bridges, fact tables, and older research-era aggregate tables

Bounded contexts:

- primary: `county scores`
- secondary: `analysis summary`, `markets`, `data and sync operations`

Catalog:

```text
bridge_county_adjacency           regular table   rows=18626     size=2880 kB
bridge_county_market              regular table   rows=123       size=80 kB
country_metrics_v1                regular table   rows=0         size=24 kB
county_market_pressure_current    regular table   rows=3221      size=2704 kB
county_metrics_v1                 regular table   rows=0         size=1712 kB
county_scores_v1                  regular table   rows=0         size=3536 kB
dim_county                        regular table   rows=3221      size=4488 kB
fact_dc_pipeline_project          regular table   rows=7474      size=3560 kB
fact_dc_pipeline_snapshot         regular table   rows=14948     size=9848 kB
fact_gas_snapshot                 regular table   rows=0         size=24 kB
fact_gen_queue_project            regular table   rows=0         size=24 kB
fact_gen_queue_snapshot           regular table   rows=0         size=24 kB
fact_generation_realized_snapshot regular table   rows=0         size=24 kB
fact_grid_friction_snapshot       regular table   rows=0         size=24 kB
fact_market_analysis_score_snapshot regular table rows=6442      size=9536 kB
fact_narrative_snapshot           regular table   rows=6442      size=4032 kB
fact_policy_event                 regular table   rows=0         size=24 kB
fact_policy_snapshot              regular table   rows=0         size=24 kB
fact_publication                  regular table   rows=2         size=48 kB
state_metrics_v1                  regular table   rows=0         size=24 kB
```

### `analytics_meta`

Purpose:

- auxiliary analytics publication tracking outside the active API read path

Bounded contexts:

- primary: `county scores`

Catalog:

```text
county_score_publications         regular table   rows=0         size=48 kB
```

### `environmental_build`

Purpose:

- flood staging and troubleshooting/probe tables

Bounded contexts:

- primary: `flood`
- secondary: `data and sync operations`

Catalog:

```text
flood_hazard_stage                regular table   rows=2579448   size=25 GB
flood_hazard_stage_probe          regular table   rows=0         size=64 kB
flood_hazard_stage_probe2         regular table   rows=0         size=80 kB
flood_hazard_stage_probe3         regular table   rows=0         size=80 kB
flood_probe                       regular table   rows=0         size=40 kB
```

### `environmental_current`

Purpose:

- live flood serving table

Bounded contexts:

- primary: `flood`
- secondary: `analysis summary`

Catalog:

```text
flood_hazard                      regular table   rows=0         size=64 kB
```

### `environmental_meta`

Purpose:

- flood run ledger

Bounded contexts:

- primary: `flood`
- secondary: `data and sync operations`

Catalog:

```text
flood_runs                        regular table   rows=0         size=48 kB
```

### `facility_current`

Purpose:

- provider dimension used by facility and provider endpoints

Bounded contexts:

- primary: `facilities`, `providers`
- secondary: `boundaries`, `shared geo sql`

Catalog:

```text
providers                         regular table   rows=883       size=224 kB
```

### `market_current`

Purpose:

- live serving market tables

Bounded contexts:

- primary: `markets`
- secondary: `analysis summary`

Catalog:

```text
market_boundaries                 regular table   rows=74        size=160 kB
markets                           regular table   rows=74        size=64 kB
```

### `market_source`

Purpose:

- upstream landed market and point-source data

Bounded contexts:

- primary: `market source sync`
- secondary: `markets`, `data and sync operations`

Catalog:

```text
colocation_points                 regular table   rows=6003      size=3240 kB
hyperscale_points                 regular table   rows=2031      size=1392 kB
market_cap_reports                regular table   rows=22        size=48 kB
market_groups                     regular table   rows=6         size=48 kB
market_quarterly_data             regular table   rows=1762      size=3312 kB
market_totals_data                regular table   rows=481       size=320 kB
market_updates                    regular table   rows=55        size=376 kB
market_yearly_data                regular table   rows=549       size=360 kB
markets                           regular table   rows=708       size=1824 kB
submarkets                        regular table   rows=59        size=96 kB
world_regions                     regular table   rows=6         size=56 kB
```

### `norm`

Purpose:

- facility normalization candidate store

Bounded contexts:

- probable: `facilities`

Catalog:

```text
facility_candidate                regular table   rows=0         size=2144 kB
```

### `ops`

Purpose:

- ingest/publish/quality control-plane tables

Bounded contexts:

- primary: `data and sync operations`

Catalog:

```text
active_data_version               regular table   rows=0         size=16 kB
ingest_run                        regular table   rows=0         size=24 kB
publish_version                   regular table   rows=0         size=24 kB
quality_gate_result               regular table   rows=0         size=32 kB
```

### `parcel_build`

Purpose:

- parcel raw-stage input

Bounded contexts:

- primary: `parcel sync`
- secondary: `parcels`, `data and sync operations`

Catalog:

```text
parcels_stage_raw                 regular table   rows=0         size=32 kB
parcels_stage_raw_20260303t045507z regular table  rows=0         size=16 kB
```

### `parcel_current`

Purpose:

- live canonical parcel table

Bounded contexts:

- primary: `parcels`
- secondary: `parcel sync`, `shared geo sql`

Catalog:

```text
parcels                           regular table   rows=0         size=115 GB
```

### `parcel_history`

Purpose:

- archived previous parcel tables from publish swaps

Bounded contexts:

- primary: `parcel sync`
- secondary: `data and sync operations`

Catalog:

```text
parcels_prev_20260302121429       regular table   rows=0         size=7176 kB
parcels_prev_20260302122008       regular table   rows=0         size=7176 kB
parcels_prev_20260302122047       regular table   rows=0         size=7160 kB
parcels_prev_20260302123045       regular table   rows=0         size=7176 kB
parcels_prev_20260302131334       regular table   rows=0         size=7304 kB
parcels_prev_20260302131909       regular table   rows=0         size=736 MB
parcels_prev_20260302132959       regular table   rows=0         size=736 MB
parcels_prev_20260302133713       regular table   rows=0         size=736 MB
parcels_prev_20260303235240       regular table   rows=0         size=7304 kB
```

### `parcel_meta`

Purpose:

- parcel ingest run and checkpoint ledger

Bounded contexts:

- primary: `parcel sync`
- secondary: `data and sync operations`

Catalog:

```text
ingestion_checkpoints             regular table   rows=0         size=32 kB
ingestion_runs                    regular table   rows=0         size=64 kB
```

### `public`

Purpose:

- PostGIS metadata and SRID catalog

Bounded contexts:

- infrastructure: shared geospatial runtime support

Catalog:

```text
geography_columns                 view            rows=0         size=0 bytes
geometry_columns                  view            rows=0         size=0 bytes
spatial_ref_sys                   regular table   rows=0         size=7144 kB
```

### `raw`

Purpose:

- raw source snapshot ledger

Bounded contexts:

- primary: `data and sync operations`

Catalog:

```text
source_snapshot                   regular table   rows=0         size=64 kB
```

### `search`

Purpose:

- search materialization table

Bounded contexts:

- probable: cross-cutting lookup/search support

Catalog:

```text
search_index                      regular table   rows=0         size=2664 kB
```

### `serve`

Purpose:

- canonical serving tables exposed to the app and supporting geometry tables

Bounded contexts:

- primary: `boundaries`, `facilities`
- secondary: `providers`, `analysis summary`

Catalog:

```text
admin_county_geom_lod0            regular table   rows=0         size=4760 kB
admin_county_geom_lod1            regular table   rows=0         size=4752 kB
admin_county_geom_lod2            regular table   rows=0         size=4752 kB
admin_county_geom_lod3            regular table   rows=0         size=4752 kB
boundary_county_geom_lod1         regular table   rows=3221      size=4752 kB
boundary_county_geom_lod2         regular table   rows=3221      size=4752 kB
boundary_county_geom_lod3         regular table   rows=3221      size=4752 kB
enterprise_site                   regular table   rows=0         size=56 kB
facility_site                     regular table   rows=0         size=10 MB
hyperscale_site                   regular table   rows=0         size=2000 kB
```

### `spatial`

Purpose:

- auxiliary spatial feature tables retained in the database

Bounded contexts:

- primary: older spatial-support context
- secondary: `markets`, `facilities`

Catalog:

```text
colo_facility_features            regular table   rows=0         size=792 kB
colo_facility_points              regular table   rows=0         size=2800 kB
enterprise_facility_points        regular table   rows=0         size=32 kB
hyperscale_facility_features      regular table   rows=0         size=920 kB
hyperscale_facility_points        regular table   rows=0         size=768 kB
internet_exchange_points          regular table   rows=0         size=72 kB
submarket_points                  regular table   rows=0         size=48 kB
```

## Index Inventory

The full index inventory is in `reports/db-index-inventory-2026-03-11.tsv`.

Important live-path index coverage includes:

- GiST geometry indexes on `serve.facility_site`, `serve.hyperscale_site`, `serve.admin_county_geom_lod*`, `serve.boundary_county_geom_lod*`, `market_current.market_boundaries`, `market_source` geometry tables, and `environmental_current.flood_hazard`
- PK and ranking/publication indexes on `analytics` serving tables
- name and updated-at indexes on provider and market dimensions
- parcel primary, state, geoid, and geometry indexes on `parcel_current.parcels`
- trigram indexes on searchable serving and search tables such as `serve.facility_site`, `serve.hyperscale_site`, `serve.enterprise_site`, `norm.facility_candidate`, and `search.search_index`

## Reader Notes

The live database is now much smaller and simpler than the pre-cleanup state:

- no `legacy` schema remains
- no `mirror` tables remain
- no project-owned partitioned tables remain
- no project-owned views remain
- only PostGIS metadata views remain outside the regular-table set

For the historical cleanup context, use:

- `reports/database-audit-report-2026-03-11.md`
- `reports/database-normalization-cleanup-2026-03-11.md`
- `reports/db-mirror-deleted-2026-03-11.tsv`
