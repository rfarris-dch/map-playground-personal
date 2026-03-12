# Database Audit Report

Date: 2026-03-11
Database: `dch_os`
Connection observed from repo env: `postgresql://dch:dch@localhost:5432/dch_os`

## Scope

This audit maps the live `dch_os` database to the current repository state.

It covers:

- live schemas, tables, partitioned tables, views, and materialized views
- runtime query paths in `apps/api`, `packages/geo-sql`, and first-party scripts
- current index coverage on relations the repo actively reads or writes
- relations present in the database but not referenced by current repo runtime or scripts
- `mirror.*` dependency verification and deletion status

Artifacts produced alongside this report:

- `reports/db-relation-inventory-2026-03-11.tsv`
- `reports/db-mirror-deleted-2026-03-11.tsv`

## Executive Findings

1. The active production path in this repo reads from `serve.*`, `analytics.*`, `market_current.*`, `facility_current.providers`, `parcel_current.parcels`, and `environmental_current.flood_hazard`.
2. The active operational path also writes and stages through `market_source.*`, `analytics` fact/bridge tables, `environmental_build.flood_hazard_stage`, `parcel_build.*`, `parcel_meta.*`, and `parcel_history.*`.
3. The live database contains a large amount of additional data not referenced by current repo runtime or scripts, especially `legacy.*`, `ops.*`, `raw.*`, `search.*`, `norm.*`, several `serve.*` relations, several `spatial.*` relations, and the research-era `analytics.*_v1` tables.
4. The repo has drift between documentation/UI copy and the current runtime path. The clearest examples are the stale references to `mirror."HAWK_MARKET"` and `mirror."HAWK_PROVIDER_PROFILE"` while the actual runtime now reads `market_current.*`, `serve.*`, and `facility_current.providers`.
5. The current county-score refresh path carries water-stress fields in its schema and API contracts, but the refresh SQL currently hard-codes `water_stress_score` to `NULL`, so the old mirror-based water-stress dataset is not on the active shipped path.
6. `mirror.*` had no database dependency chain from views, functions, triggers, or foreign keys and no current repo runtime dependency. All `mirror.*` tables were deleted during this audit.

## Mirror Deletion Result

Status:

- all `mirror.*` tables deleted successfully
- `mirror` schema now has no remaining tables, views, partitioned tables, or materialized views

Dependency verification before delete:

- no view definitions referenced `mirror.*`
- no function bodies referenced `mirror.*`
- no non-internal triggers referenced `mirror.*`
- no foreign keys referenced `mirror.*`

Deleted table set:

- `mirror."BLOG_AUTHOR"`
- `mirror."BLOG_CATEGORY"`
- `mirror."COUNTY"`
- `mirror."HAWK_BLC_PRODUCT"`
- `mirror."HAWK_BLOG"`
- `mirror."HAWK_BLOG_MEDIA_MAP"`
- `mirror."HAWK_FACILITY_CAPACITY"`
- `mirror."HAWK_FACILITY_INFO"`
- `mirror."HAWK_FACILITY_LOCATION"`
- `mirror."HAWK_INTERNET_EXCHANGE_FACILITY"`
- `mirror."HAWK_LISTING_COLO"`
- `mirror."HAWK_MARKET"`
- `mirror."HAWK_MARKET_QUARTERLY_DATA"`
- `mirror."HAWK_POWER_SPACE_INFO"`
- `mirror."HAWK_PROVIDER_PROFILE"`
- `mirror."HAWK_SUBMARKET"`
- `mirror."HAWK_SWAP"`
- `mirror."HYPERSCALE_FACILITY"`
- `mirror."HYPERSCALE_HISTORICAL_CAPACITY"`
- `mirror."HYPERSCALE_PROVIDER"`
- `mirror."MARKET_ACTIVITY"`
- `mirror.market_capacity_total`
- `mirror.mirror_meta`
- `mirror.mirror_sync_meta`
- `mirror.satellite_change_detections`
- `mirror.satellite_imagery_snapshots`
- `mirror.satellite_tracked_facilities`
- `mirror.water_stress_basins`
- `mirror.water_stress_basins_import`
- `mirror.water_stress_facility_cache`

Pre-delete footprint:

- approximately `918 MiB` total from `reports/db-mirror-deleted-2026-03-11.tsv`

## Active Runtime Path

### `serve.facility_site`

Purpose:

- canonical colocation facility serving relation for map/API reads

Used by:

- facility bbox/polygon/detail SQL builders in `packages/geo-sql/src/index.ts`
- facility endpoints in `apps/api/src/geo/facilities/facilities.repo.ts`
- provider aggregation in `apps/api/src/geo/providers/providers.repo.ts`
- boundary power aggregation in `apps/api/src/geo/boundaries/boundaries.repo.ts`
- analysis summary in `apps/api/src/geo/analysis-summary/analysis-summary.service.ts`

Live DB shape:

- table in the live database, not a view

Index coverage observed:

- PK on `facility_id`
- unique key on `facility_slug`
- GiST on `geom_3857`
- GiST on `geog`
- trigram GIN on `facility_name_norm`
- btree on `(county_fips, provider_id)`
- btree on `(provider_id, commissioned_semantic)`
- btree on `(state_abbrev, county_fips)`

### `serve.hyperscale_site`

Purpose:

- canonical hyperscale facility serving relation for map/API reads

Used by:

- hyperscale bbox/polygon/detail SQL builders in `packages/geo-sql/src/index.ts`
- facility endpoints in `apps/api/src/geo/facilities/facilities.repo.ts`
- provider aggregation in `apps/api/src/geo/providers/providers.repo.ts`
- boundary power aggregation in `apps/api/src/geo/boundaries/boundaries.repo.ts`

Live DB shape:

- table in the live database, not a view

Index coverage observed:

- PK on `hyperscale_id`
- GiST on `geom_3857`
- GiST on `geog`
- trigram GIN on `facility_name_norm`
- btree on `(county_fips, provider_id)`
- btree on `(state_abbrev, lease_or_own)`

### `facility_current.providers`

Purpose:

- provider dimension joined onto serving relations and provider rollups

Used by:

- joins from `packages/geo-sql/src/index.ts`
- provider repo aggregation in `apps/api/src/geo/providers/providers.repo.ts`
- refresh path in `scripts/sql/refresh-facility-providers.sql`

Index coverage observed:

- PK on `provider_id`
- btree on `provider_name`
- btree on `updated_at DESC`

### `parcel_current.parcels`

Purpose:

- canonical parcel read path for parcel detail and flood overlay work

Used by:

- parcel SQL builders in `packages/geo-sql/src/index.ts`
- flood overlay queries in `apps/api/src/geo/flood/flood.repo.ts`
- parcel tile build in `scripts/build-parcels-draw-pmtiles.sh`

Index coverage observed on live canonical table:

- PK on `parcel_id`
- btree on `geoid`
- btree on `state2`
- GiST on `geom_3857`

Observed drift:

- repo DDL history includes additional canonical indexes such as `source_oid` and `attrs` GIN, but the live `parcel_current.parcels` relation currently exposes the smaller index set above

### `environmental_current.flood_hazard`

Purpose:

- live flood hazard polygon store for API and tile builds

Used by:

- flood read path in `apps/api/src/geo/flood/flood.repo.ts`
- readiness/relation checks in `apps/api/src/geo/flood/flood.service.ts`
- environmental flood tile build in `scripts/build-environmental-flood-pmtiles.sh`

Index coverage observed:

- PK on `feature_id`
- btree on `run_id`
- btree on `data_version DESC`
- btree on `flood_band`
- btree on `is_flood_100`
- btree on `is_flood_500`
- GiST on `geom_3857`

### `market_current.market_boundaries`

Purpose:

- market geometry used for market selection and summary overlays

Used by:

- market selection in `apps/api/src/geo/markets/markets-selection.repo.ts`
- analysis summary in `apps/api/src/geo/analysis-summary/analysis-summary.repo.ts`

Index coverage observed:

- PK on `market_id`
- GiST on `geom`

### `market_current.markets`

Purpose:

- market metadata and summary records used in market listing and selection

Used by:

- `apps/api/src/geo/markets/markets.repo.ts`
- `apps/api/src/geo/markets/markets-selection.repo.ts`

Index coverage observed:

- PK on `market_id`
- btree on `name`
- btree on `updated_at DESC`

### `serve.boundary_county_geom_lod1`

Purpose:

- county geometry view used for county-score joins and analysis summaries

Used by:

- `apps/api/src/geo/county-scores/county-scores.repo.ts`
- `apps/api/src/geo/analysis-summary/analysis-summary.repo.ts`
- `scripts/sql/refresh-county-scores.sql`

Live DB shape:

- view

### `serve.boundary_county_geom_lod2`

Purpose:

- state-aggregated county boundary view for boundary overlays

Used by:

- `apps/api/src/geo/boundaries/boundaries.repo.ts`

Live DB shape:

- view

### `serve.boundary_county_geom_lod3`

Purpose:

- country-aggregated county boundary view for boundary overlays and market-boundary refresh joins

Used by:

- `apps/api/src/geo/boundaries/boundaries.repo.ts`
- `scripts/sql/refresh-market-boundaries.sql`

Live DB shape:

- view

### `analytics.county_market_pressure_current`

Purpose:

- live county-intelligence serving table used by API responses

Used by:

- county-score SQL in `packages/geo-sql/src/index.ts`
- county-score API reads in `apps/api/src/geo/county-scores/county-scores.repo.ts`

Index coverage observed:

- PK on `county_geoid`
- btree on `(rank_status, market_pressure_index DESC)`

### `analytics.dim_county`

Purpose:

- county dimension and geometry backbone for county-score refresh and readiness reporting

Used by:

- county refresh SQL in `scripts/sql/refresh-county-scores.sql`
- API readiness counts in `apps/api/src/geo/county-scores/county-scores.repo.ts`

Index coverage observed:

- PK on `county_geoid`
- btree on `state_abbrev`
- GiST on `geom_3857`

### `analytics.fact_publication`

Purpose:

- publication metadata for the county-score dataset

Used by:

- county-score publication metadata reads in `apps/api/src/geo/county-scores/county-scores.repo.ts`
- readiness/error messaging in `apps/api/src/geo/county-scores/county-scores.service.ts`

Index coverage observed:

- PK on `publication_run_id`
- btree on `published_at DESC`

## Operational and Script-Only Path

These relations are part of the repo’s maintained load/refresh path even when they are not directly returned by runtime APIs.

### `market_source.*`

Purpose:

- staging/landing schema for upstream market and hyperscale source data

Produced by:

- `scripts/sync-market-source.sh`

Relations and roles:

- `market_source.market_groups`: market grouping dimension
- `market_source.world_regions`: world-region dimension with boundary geometry
- `market_source.markets`: upstream market dimension with center geometry
- `market_source.submarkets`: upstream submarket dimension with geometry
- `market_source.market_quarterly_data`: quarterly market metrics
- `market_source.market_yearly_data`: yearly market metrics
- `market_source.market_totals_data`: aggregate market totals
- `market_source.market_updates`: market update text or metadata by market/quarter
- `market_source.market_cap_reports`: capacity report metadata
- `market_source.colocation_points`: point feed for colocation supply
- `market_source.hyperscale_points`: point feed for hyperscale supply

Observed indexes:

- PKs across all relations
- btree market-id indexes across time-series relations
- GiST geometry indexes on `markets.center`, `submarkets.geom`, `colocation_points.geom`, `hyperscale_points.geom`, `world_regions.boundary`

### `analytics` bridge/fact refresh relations

Purpose:

- intermediate and published county-score data products built by `scripts/sql/refresh-county-scores.sql`

Relations and roles:

- `analytics.bridge_county_adjacency`: county adjacency graph
- `analytics.bridge_county_market`: county to market seam map
- `analytics.fact_dc_pipeline_project`: deduplicated project-level demand facts
- `analytics.fact_dc_pipeline_snapshot`: publication-scoped demand snapshot
- `analytics.fact_gen_queue_project`: project-level supply queue facts
- `analytics.fact_gen_queue_snapshot`: supply queue snapshot
- `analytics.fact_generation_realized_snapshot`: realized generation snapshot
- `analytics.fact_grid_friction_snapshot`: grid-friction snapshot
- `analytics.fact_policy_event`: policy event ledger
- `analytics.fact_policy_snapshot`: policy scoring snapshot
- `analytics.fact_gas_snapshot`: gas-infrastructure snapshot
- `analytics.fact_market_analysis_score_snapshot`: county score snapshot by publication
- `analytics.fact_narrative_snapshot`: narrative/explanation payload snapshot

Observed index pattern:

- PK or uniqueness on publication/run or natural grain
- date or month descending indexes paired with county keys

### `environmental_build.*`

Purpose:

- flood normalization and load staging schema

Relations and roles:

- `environmental_build.flood_hazard_stage`: active flood load stage table used by `scripts/refresh-environmental-flood.ts`
- `environmental_build.flood_hazard_stage_probe`, `probe2`, `probe3`, `flood_probe`: probe and troubleshooting remnants in the build schema

Observed index pattern:

- GiST geometry indexes on the stage/probe tables
- only `flood_hazard_stage` is referenced by current scripts and status APIs

### Parcel ingest lifecycle

Purpose:

- raw parcel staging, publish history, and ingest audit trail

Relations and roles:

- `parcel_build.parcels_stage_raw`: staged raw parcel JSON rows
- `parcel_build.parcels_stage_raw_20260303t045507z`: timestamped raw-stage leftover
- `parcel_meta.ingestion_runs`: parcel publish run ledger
- `parcel_meta.ingestion_checkpoints`: per-state/shard checkpoint ledger
- `parcel_history.parcels_prev_*`: archived previous canonical parcel tables created during swap

Observed relation behavior:

- current repo reads `parcel_current.parcels`
- repo writes and archives through `parcel_build`, `parcel_meta`, and `parcel_history`

### `spatial.submarket_points`

Purpose:

- spatial submarket point source used when composing market boundaries

Used by:

- `scripts/sql/refresh-market-boundaries.sql`

## Present in the Database but Not Referenced by Current Repo Runtime or Scripts

These relations exist in `dch_os`, but no current runtime query path or maintained first-party script in this repo points at them directly.

### Research-era or draft analytics

- `analytics.country_metrics_v1`
- `analytics.county_metrics_v1`
- `analytics.county_scores_v1`
- `analytics.state_metrics_v1`
- `analytics_meta.county_score_publications`

Role from naming and surrounding docs:

- research/draft aggregate tables from earlier county-attractiveness work

### Unused operational schemas in current repo

- `ops.active_data_version`
- `ops.ingest_run`
- `ops.publish_version`
- `ops.quality_gate_result`
- `raw.source_snapshot`
- `search.search_index`
- `norm.facility_candidate`

Role from naming:

- ingest/publish control plane, raw lineage capture, search materialization, and facility-normalization candidate staging

### Unused `serve` relations in current repo

- `serve.admin_county_geom_lod0`
- `serve.admin_county_geom_lod1`
- `serve.admin_county_geom_lod2`
- `serve.admin_county_geom_lod3`
- `serve.enterprise_site`
- `serve.parcel`
- `serve.parcel_default`

Role from naming:

- alternate county/admin geometry materializations
- enterprise facility serving relation
- parcel serving partition root/default child

### Unused `spatial` relations in current repo

- `spatial.colo_facility_features`
- `spatial.colo_facility_points`
- `spatial.enterprise_facility_points`
- `spatial.hyperscale_facility_features`
- `spatial.hyperscale_facility_points`
- `spatial.internet_exchange_points`

Role from naming:

- older or alternate point/feature source layers that predate the current `serve.*` path

### Parcel shard tables not directly referenced by repo code

- `parcel_current.parcels_ak`
- `parcel_current.parcels_al`
- `parcel_current.parcels_ar`
- `parcel_current.parcels_as`
- `parcel_current.parcels_az`
- `parcel_current.parcels_ca`
- `parcel_current.parcels_co`
- `parcel_current.parcels_ct`
- `parcel_current.parcels_dc`
- `parcel_current.parcels_de`
- `parcel_current.parcels_fl`
- `parcel_current.parcels_ga`
- `parcel_current.parcels_gu`
- `parcel_current.parcels_hi`
- `parcel_current.parcels_ia`
- `parcel_current.parcels_id`
- `parcel_current.parcels_il`
- `parcel_current.parcels_in`
- `parcel_current.parcels_ks`
- `parcel_current.parcels_ky`
- `parcel_current.parcels_la`
- `parcel_current.parcels_ma`
- `parcel_current.parcels_md`
- `parcel_current.parcels_me`
- `parcel_current.parcels_mi`
- `parcel_current.parcels_mn`
- `parcel_current.parcels_mo`
- `parcel_current.parcels_mp`
- `parcel_current.parcels_ms`
- `parcel_current.parcels_mt`
- `parcel_current.parcels_nc`
- `parcel_current.parcels_nd`
- `parcel_current.parcels_ne`
- `parcel_current.parcels_nh`
- `parcel_current.parcels_nj`
- `parcel_current.parcels_nm`
- `parcel_current.parcels_nv`
- `parcel_current.parcels_ny`
- `parcel_current.parcels_oh`
- `parcel_current.parcels_ok`
- `parcel_current.parcels_or`
- `parcel_current.parcels_pa`
- `parcel_current.parcels_pr`
- `parcel_current.parcels_ri`
- `parcel_current.parcels_sc`
- `parcel_current.parcels_sd`
- `parcel_current.parcels_tn`
- `parcel_current.parcels_tx`
- `parcel_current.parcels_ut`
- `parcel_current.parcels_va`
- `parcel_current.parcels_vi`
- `parcel_current.parcels_vt`
- `parcel_current.parcels_wa`
- `parcel_current.parcels_wi`
- `parcel_current.parcels_wv`
- `parcel_current.parcels_wy`
- `parcel_current.parcels_prev_20260302021414`

Role from naming:

- state-sharded or swap-residual parcel relations inside the database design

Important boundary:

- these are not direct read targets in repo code, but they may still be part of the database’s internal physical layout or publish history

### Entire `legacy` schema

Status:

- present in the database
- not referenced by current runtime or maintained scripts in this repo

Family breakdown:

- `legacy.BLC_*`: Broadleaf commerce/admin/content model tables
- `legacy.HAWK_*`: Hawk product, market, provider, facility, user, and editorial write-model tables
- `legacy.HYPERSCALE_*`: legacy hyperscale provider/facility model tables
- `legacy.*_bak*`, `*_backup*`, `*_temp*`: point-in-time backups and temporary working copies
- additional support tables such as `MARKET_GROUP`, `WORLD_REGION`, `COLO_CAPACITY`, `DATABASECHANGELOG`, `SEQUENCE_GENERATOR`, and fiber/site user cross-reference tables

Interpretation:

- the live database still contains a large historical application database that the current repo has largely moved away from

## Mirror Schema Deep Dive

The deleted `mirror.*` tables fell into these functional buckets:

### Editorial and taxonomy

- `BLOG_AUTHOR`
- `BLOG_CATEGORY`
- `HAWK_BLOG`
- `HAWK_BLOG_MEDIA_MAP`

These were mirror copies of blog/editorial entities.

### Facility, provider, market, and transaction read copies

- `COUNTY`
- `HAWK_BLC_PRODUCT`
- `HAWK_FACILITY_CAPACITY`
- `HAWK_FACILITY_INFO`
- `HAWK_FACILITY_LOCATION`
- `HAWK_INTERNET_EXCHANGE_FACILITY`
- `HAWK_LISTING_COLO`
- `HAWK_MARKET`
- `HAWK_MARKET_QUARTERLY_DATA`
- `HAWK_POWER_SPACE_INFO`
- `HAWK_PROVIDER_PROFILE`
- `HAWK_SUBMARKET`
- `HAWK_SWAP`
- `MARKET_ACTIVITY`
- `market_capacity_total`

These were read-copy mirrors of the older Hawk market/provider/facility model and related editorial or transaction datasets.

### Hyperscale read copies

- `HYPERSCALE_FACILITY`
- `HYPERSCALE_HISTORICAL_CAPACITY`
- `HYPERSCALE_PROVIDER`

These were mirror copies of the older hyperscale model.

### Mirror runtime metadata

- `mirror_meta`
- `mirror_sync_meta`

These tracked mirror load/sync state and cursor progress.

### Satellite feature tracking

- `satellite_change_detections`
- `satellite_imagery_snapshots`
- `satellite_tracked_facilities`

These held facility-centric satellite monitoring state.

### Water-stress dataset

- `water_stress_basins`
- `water_stress_basins_import`
- `water_stress_facility_cache`

These supported the old water-stress path that is no longer active in the current shipped county-score refresh SQL.

## Drift and Mismatch Findings

1. `apps/web/src/pages/markets-page.vue` still describes markets as coming from `mirror."HAWK_MARKET"`, while the actual runtime path reads `market_current.markets`.
2. `apps/web/src/pages/providers-page.vue` still describes providers as coming from `mirror."HAWK_PROVIDER_PROFILE"`, while the actual runtime path reads from `serve.facility_site`, `serve.hyperscale_site`, and `facility_current.providers`.
3. `apps/docs/src/content/applications/api-geo-slices.md` still says repo slices execute against mirror tables, which no longer matches the runtime code.
4. Historical DDL in `scripts/sql/spatial-analysis-overhaul.ddl.sql` models `serve.facility_site` and `serve.hyperscale_site` as views, but the live database currently exposes them as indexed tables.
5. County-score contracts and row mappers still carry `water_stress_score`, but `scripts/sql/refresh-county-scores.sql` currently populates the value with `NULL`.

## Current Relation Inventory by Schema

See `reports/db-relation-inventory-2026-03-11.tsv` for the exact schema/relation inventory with relation kind, estimated row counts from stats, and on-disk size.

High-level current inventory after mirror deletion:

- `_tmpcopy`: transient copy table
- `analytics`: live county-score serving, bridge, fact, and research-era aggregate tables
- `analytics_meta`: publication metadata table not referenced by current repo runtime/scripts
- `environmental_build`: flood staging and probe tables
- `environmental_current`: flood serving table
- `environmental_meta`: flood run ledger
- `facility_current`: provider dimension
- `legacy`: historical Broadleaf/Hawk application database and backups
- `market_current`: live serving market tables
- `market_source`: upstream landing market tables
- `norm`: facility candidate normalization table
- `ops`: publish/quality control-plane tables
- `parcel_build`: parcel raw stage tables
- `parcel_current`: canonical parcel table, parcel shard tables, and one publish residual
- `parcel_history`: archived previous parcel tables
- `parcel_meta`: parcel run/checkpoint ledger
- `public`: PostGIS metadata and catalog views
- `raw`: raw source snapshot ledger
- `search`: search materialization table
- `serve`: canonical serving tables, partition root/default, admin geometry tables, and county-boundary views
- `spatial`: alternate or upstream spatial feature tables

## Index Coverage Summary on Active Path

Observed active-path index posture:

- spatial read relations used for geometry intersection all have GiST indexes on geometry columns
- name-based serving relations used for search/list surfaces expose trigram indexes on normalized names
- provider and market dimensions expose stable PKs and name/updated-at indexes
- county-score publication and ranking tables expose PKs plus publication or ranking indexes
- market-source operational tables expose PKs, market-id lookup indexes, and GiST indexes on point or polygon geometry where applicable

Observed active-path gaps or asymmetries:

- live `parcel_current.parcels` currently exposes a leaner index set than the broader canonical DDL history
- `serve.facility_site` / `serve.hyperscale_site` live shape differs from the historical repo DDL expectation

## Closing State

At the end of this audit:

- active repo path is centered on `serve.*`, `market_current.*`, `analytics.*`, `facility_current.providers`, `parcel_current.parcels`, and `environmental_current.flood_hazard`
- operational refresh path remains centered on `market_source.*`, `analytics` bridge/fact tables, `environmental_build.*`, and parcel ingest schemas
- `mirror.*` is removed from the database
- `legacy.*` and several other schemas remain present but are not referenced by current repo runtime or maintained scripts
