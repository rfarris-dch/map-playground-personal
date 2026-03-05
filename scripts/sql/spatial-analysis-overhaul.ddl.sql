-- =========================================================
-- Spatial Analysis Overhaul: PostGIS Read/Spatial Store DDL
-- =========================================================
-- SRID strategy:
--   - canonical geometry in 4326
--   - web/metric geometry in 3857 for distance/KNN and tiling
--
-- This migration is additive and preserves current parcels anchors.
-- =========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS parcel_meta;
CREATE SCHEMA IF NOT EXISTS parcel_build;
CREATE SCHEMA IF NOT EXISTS parcel_current;
CREATE SCHEMA IF NOT EXISTS parcel_history;

CREATE SCHEMA IF NOT EXISTS facility_meta;
CREATE SCHEMA IF NOT EXISTS facility_current;

CREATE SCHEMA IF NOT EXISTS boundary_meta;
CREATE SCHEMA IF NOT EXISTS boundary_current;

CREATE SCHEMA IF NOT EXISTS market_meta;
CREATE SCHEMA IF NOT EXISTS market_current;

CREATE SCHEMA IF NOT EXISTS infra_current;

CREATE SCHEMA IF NOT EXISTS analysis_meta;
CREATE SCHEMA IF NOT EXISTS analysis_current;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS serve;

-- =========================================================
-- 1) Parcels
-- =========================================================

CREATE TABLE IF NOT EXISTS parcel_meta.ingestion_runs (
  run_id text PRIMARY KEY,
  data_version date NOT NULL,
  source_service text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_runs_data_version_idx
  ON parcel_meta.ingestion_runs (data_version DESC);

CREATE TABLE IF NOT EXISTS parcel_meta.ingestion_checkpoints (
  run_id text NOT NULL REFERENCES parcel_meta.ingestion_runs(run_id) ON DELETE CASCADE,
  state2 char(2) NOT NULL,
  shard_id text NOT NULL,
  last_source_oid bigint,
  expected_count bigint NOT NULL DEFAULT 0,
  pages_fetched integer NOT NULL DEFAULT 0,
  rows_written bigint NOT NULL DEFAULT 0,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, state2, shard_id)
);

CREATE TABLE IF NOT EXISTS parcel_current.parcels (
  parcel_id text PRIMARY KEY,
  source_oid bigint,
  state2 text,
  geoid text,
  source_updated_at timestamptz,
  ingestion_run_id text NOT NULL REFERENCES parcel_meta.ingestion_runs(run_id) ON DELETE RESTRICT,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  centroid_4326 geometry(Point, 4326),
  centroid_3857 geometry(Point, 3857)
);

CREATE INDEX IF NOT EXISTS parcels_source_oid_idx ON parcel_current.parcels (source_oid);
CREATE INDEX IF NOT EXISTS parcels_state2_idx ON parcel_current.parcels (state2);
CREATE INDEX IF NOT EXISTS parcels_geoid_idx ON parcel_current.parcels (geoid);
CREATE INDEX IF NOT EXISTS parcels_geom_3857_gist_idx
  ON parcel_current.parcels USING gist (geom_3857);
CREATE INDEX IF NOT EXISTS parcels_centroid_3857_gist_idx
  ON parcel_current.parcels USING gist (centroid_3857);
CREATE INDEX IF NOT EXISTS parcels_attrs_gin_idx
  ON parcel_current.parcels USING gin (attrs jsonb_path_ops);

CREATE TABLE IF NOT EXISTS parcel_history.parcels_history (
  LIKE parcel_current.parcels INCLUDING ALL
) PARTITION BY LIST (ingestion_run_id);

-- =========================================================
-- 2) Facilities (separate perspective tables)
-- =========================================================

CREATE TABLE IF NOT EXISTS facility_current.providers (
  provider_id text PRIMARY KEY,
  provider_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_current.colocation_facilities (
  facility_id text PRIMARY KEY,
  facility_name text NOT NULL,
  provider_id text REFERENCES facility_current.providers(provider_id),
  county_fips text NOT NULL,
  state_abbrev text,
  commissioned_semantic text NOT NULL,
  lease_or_own text,
  commissioned_power_mw numeric,
  planned_power_mw numeric,
  under_construction_power_mw numeric,
  available_power_mw numeric,
  freshness_ts timestamptz,
  geom geometry(Point, 4326) NOT NULL,
  geom_3857 geometry(Point, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS colo_facilities_geom_3857_gist
  ON facility_current.colocation_facilities USING gist (geom_3857);
CREATE INDEX IF NOT EXISTS colo_facilities_county_fips_idx
  ON facility_current.colocation_facilities (county_fips);

CREATE TABLE IF NOT EXISTS facility_current.hyperscale_facilities (
  hyperscale_id text PRIMARY KEY,
  facility_name text NOT NULL,
  provider_id text REFERENCES facility_current.providers(provider_id),
  county_fips text NOT NULL,
  state_abbrev text,
  commissioned_semantic text NOT NULL,
  lease_or_own text,
  commissioned_power_mw numeric,
  planned_power_mw numeric,
  under_construction_power_mw numeric,
  freshness_ts timestamptz,
  geom geometry(Point, 4326) NOT NULL,
  geom_3857 geometry(Point, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS hyper_facilities_geom_3857_gist
  ON facility_current.hyperscale_facilities USING gist (geom_3857);

CREATE OR REPLACE VIEW serve.facility_site AS
SELECT
  facility_id,
  facility_name,
  provider_id,
  state_abbrev,
  commissioned_semantic,
  NULL::text AS lease_or_own,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  freshness_ts,
  ST_AsGeoJSON(geom)::jsonb AS geom_json,
  county_fips
FROM facility_current.colocation_facilities;

CREATE OR REPLACE VIEW serve.hyperscale_site AS
SELECT
  hyperscale_id,
  facility_name,
  provider_id,
  state_abbrev,
  commissioned_semantic,
  lease_or_own,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  freshness_ts,
  ST_AsGeoJSON(geom)::jsonb AS geom_json,
  county_fips
FROM facility_current.hyperscale_facilities;

-- =========================================================
-- 3) Boundary sets
-- =========================================================

CREATE TABLE IF NOT EXISTS boundary_meta.boundary_sets (
  boundary_set_id text PRIMARY KEY,
  boundary_set_version integer NOT NULL,
  boundary_type text NOT NULL,
  name text NOT NULL,
  description text,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text,
  status text NOT NULL DEFAULT 'published',
  content_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS boundary_current.boundary_regions (
  boundary_set_id text NOT NULL REFERENCES boundary_meta.boundary_sets(boundary_set_id) ON DELETE CASCADE,
  boundary_set_version integer NOT NULL,
  region_id text NOT NULL,
  region_name text NOT NULL,
  parent_region_id text,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  PRIMARY KEY (boundary_set_id, boundary_set_version, region_id)
);

CREATE INDEX IF NOT EXISTS boundary_regions_geom_3857_gist
  ON boundary_current.boundary_regions USING gist (geom_3857);

-- =========================================================
-- 4) Infra for proximity
-- =========================================================

CREATE TABLE IF NOT EXISTS infra_current.power_substations (
  substation_id text PRIMARY KEY,
  name text,
  voltage_kv numeric,
  capacity_mw_est numeric,
  capacity_mw_ci_low numeric,
  capacity_mw_ci_high numeric,
  confidence_score numeric,
  geom geometry(Point, 4326) NOT NULL,
  geom_3857 geometry(Point, 3857) NOT NULL,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS power_substations_geom_3857_gist
  ON infra_current.power_substations USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS infra_current.fiber_segments (
  segment_id text PRIMARY KEY,
  network_type text NOT NULL,
  provider text,
  geom geometry(LineString, 4326) NOT NULL,
  geom_3857 geometry(LineString, 3857) NOT NULL,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS fiber_segments_geom_3857_gist
  ON infra_current.fiber_segments USING gist (geom_3857);

-- =========================================================
-- 5) Analysis models and caches
-- =========================================================

CREATE TABLE IF NOT EXISTS analysis_meta.scoring_models (
  model_id text NOT NULL,
  model_version integer NOT NULL,
  name text NOT NULL,
  description text,
  definition_json jsonb NOT NULL,
  definition_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  status text NOT NULL DEFAULT 'active',
  PRIMARY KEY (model_id, model_version)
);

CREATE TABLE IF NOT EXISTS analysis_current.parcel_scores (
  model_id text NOT NULL,
  model_version integer NOT NULL,
  ingestion_run_id text NOT NULL,
  boundary_set_id text,
  boundary_set_version integer,
  parcel_id text NOT NULL,
  score_total numeric NOT NULL,
  confidence_score numeric NOT NULL,
  constraints_json jsonb NOT NULL,
  components_json jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, model_version, ingestion_run_id, parcel_id)
);

CREATE INDEX IF NOT EXISTS parcel_scores_lookup_idx
  ON analysis_current.parcel_scores (ingestion_run_id, score_total DESC);

CREATE TABLE IF NOT EXISTS analysis_current.proximity_cache (
  ingestion_run_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  neighbor_type text NOT NULL,
  neighbors_json jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ingestion_run_id, target_type, target_id, neighbor_type)
);

-- =========================================================
-- 6) App artifacts and governance
-- =========================================================

CREATE TABLE IF NOT EXISTS app.entitlements (
  entitlement_id text PRIMARY KEY,
  principal_id text NOT NULL,
  role text NOT NULL,
  policy_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.saved_views (
  view_id text PRIMARY KEY,
  owner_principal_id text NOT NULL,
  visibility text NOT NULL,
  name text NOT NULL,
  description text,
  payload_json jsonb NOT NULL,
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_views_owner_idx
  ON app.saved_views (owner_principal_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS app.audit_log (
  audit_id bigserial PRIMARY KEY,
  principal_id text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  request_id text,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
