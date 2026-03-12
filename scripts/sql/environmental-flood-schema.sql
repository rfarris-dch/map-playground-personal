BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS environmental_meta;
CREATE SCHEMA IF NOT EXISTS environmental_build;
CREATE SCHEMA IF NOT EXISTS environmental_current;

CREATE TABLE IF NOT EXISTS environmental_meta.flood_runs (
  run_id text PRIMARY KEY,
  data_version text NOT NULL,
  source_path text,
  source_url text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flood_runs_data_version_idx
  ON environmental_meta.flood_runs (data_version DESC);

CREATE TABLE IF NOT EXISTS environmental_current.flood_hazard (
  feature_id text PRIMARY KEY,
  dfirm_id text,
  fld_zone text NOT NULL,
  zone_subty text,
  sfha_tf text,
  source_cit text,
  is_flood_100 boolean NOT NULL,
  is_flood_500 boolean NOT NULL,
  flood_band text NOT NULL,
  legend_key text NOT NULL,
  data_version text NOT NULL,
  run_id text NOT NULL REFERENCES environmental_meta.flood_runs(run_id) ON DELETE RESTRICT,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flood_hazard_run_id_idx
  ON environmental_current.flood_hazard (run_id);

CREATE INDEX IF NOT EXISTS flood_hazard_data_version_idx
  ON environmental_current.flood_hazard (data_version DESC);

CREATE INDEX IF NOT EXISTS flood_hazard_geom_3857_gist_idx
  ON environmental_current.flood_hazard USING gist (geom_3857);

CREATE INDEX IF NOT EXISTS flood_hazard_band_idx
  ON environmental_current.flood_hazard (flood_band);

CREATE INDEX IF NOT EXISTS flood_hazard_flood_100_idx
  ON environmental_current.flood_hazard (is_flood_100);

CREATE INDEX IF NOT EXISTS flood_hazard_flood_500_idx
  ON environmental_current.flood_hazard (is_flood_500);

COMMIT;
