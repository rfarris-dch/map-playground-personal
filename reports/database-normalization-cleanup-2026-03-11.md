# Database Normalization Cleanup

Date: 2026-03-11
Database: `dch_os`

## Executed Changes

The following database cleanup was completed:

- dropped the entire `legacy` schema
- kept `mirror` removed
- replaced `serve.boundary_county_geom_lod1` with a regular table populated from `serve.admin_county_geom_lod1`
- replaced `serve.boundary_county_geom_lod2` with a regular table populated from `serve.admin_county_geom_lod2`
- replaced `serve.boundary_county_geom_lod3` with a regular table populated from `serve.admin_county_geom_lod3`
- dropped the unused partitioned table `serve.parcel` and its empty child `serve.parcel_default`
- dropped the unused empty partitioned table `parcel_current.parcels_prev_20260302021414` and its empty child partition set

## Current Object-Type State

Current non-system relation counts:

- `82` regular tables
- `0` partitioned tables
- `2` views

The only non-regular relations still present are PostGIS catalog views:

- `public.geometry_columns`
- `public.geography_columns`

No project-owned schemas now contain partitioned tables, views, or materialized views.

## Current Naming State

All remaining relation names are lowercase.

There are no mixed-case table or view names left in the live database.

## Schema State After Cleanup

Removed:

- `legacy`
- `mirror` table set

Retained active schemas:

- `analytics`
- `analytics_meta`
- `environmental_build`
- `environmental_current`
- `environmental_meta`
- `facility_current`
- `market_current`
- `market_source`
- `norm`
- `ops`
- `parcel_build`
- `parcel_current`
- `parcel_history`
- `parcel_meta`
- `raw`
- `search`
- `serve`
- `spatial`

## Verification Notes

- `serve.boundary_county_geom_lod1` is now a regular table with `3221` rows
- `serve.boundary_county_geom_lod2` is now a regular table with `3221` rows
- `serve.boundary_county_geom_lod3` is now a regular table with `3221` rows
- `serve.parcel_default` was empty at deletion time
- `parcel_current.parcels_prev_20260302021414` was empty at deletion time
- `parcel_current.parcels` remains intact with `24,575,367` rows

## Artifacts

- `reports/db-relation-inventory-2026-03-11.tsv`
- `reports/db-mirror-deleted-2026-03-11.tsv`
- `reports/database-audit-report-2026-03-11.md` for the pre-cleanup audit snapshot
