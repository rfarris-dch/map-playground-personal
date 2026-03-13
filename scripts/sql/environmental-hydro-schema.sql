BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS environmental_meta;
CREATE SCHEMA IF NOT EXISTS environmental_build;
CREATE SCHEMA IF NOT EXISTS environmental_current;
CREATE SCHEMA IF NOT EXISTS environmental_tiles;

CREATE TABLE IF NOT EXISTS environmental_meta.hydro_runs (
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

CREATE INDEX IF NOT EXISTS hydro_runs_data_version_idx
  ON environmental_meta.hydro_runs (data_version DESC);

CREATE TABLE IF NOT EXISTS environmental_build.hydro_feature_stage (
  run_id text NOT NULL,
  feature_kind text NOT NULL,
  huc_level integer NOT NULL,
  raw_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS hydro_feature_stage_run_id_idx
  ON environmental_build.hydro_feature_stage (run_id);

CREATE INDEX IF NOT EXISTS hydro_feature_stage_kind_level_idx
  ON environmental_build.hydro_feature_stage (feature_kind, huc_level);

CREATE TABLE IF NOT EXISTS environmental_current.hydro_huc_polygons (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE RESTRICT,
  huc_level integer NOT NULL,
  huc text,
  name text,
  areasqkm double precision,
  states text,
  data_version text NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_huc_polygons_run_id_idx
  ON environmental_current.hydro_huc_polygons (run_id);

CREATE INDEX IF NOT EXISTS hydro_huc_polygons_level_idx
  ON environmental_current.hydro_huc_polygons (huc_level);

CREATE INDEX IF NOT EXISTS hydro_huc_polygons_geom_3857_gist_idx
  ON environmental_current.hydro_huc_polygons USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS environmental_current.hydro_huc_lines (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE RESTRICT,
  huc_level integer NOT NULL,
  data_version text NOT NULL,
  geom geometry(MultiLineString, 4326) NOT NULL,
  geom_3857 geometry(MultiLineString, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_huc_lines_run_id_idx
  ON environmental_current.hydro_huc_lines (run_id);

CREATE INDEX IF NOT EXISTS hydro_huc_lines_level_idx
  ON environmental_current.hydro_huc_lines (huc_level);

CREATE INDEX IF NOT EXISTS hydro_huc_lines_geom_3857_gist_idx
  ON environmental_current.hydro_huc_lines USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS environmental_current.hydro_huc_labels (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE RESTRICT,
  huc_level integer NOT NULL,
  huc text,
  name text,
  areasqkm double precision,
  label_rank double precision,
  states text,
  data_version text NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  geom_3857 geometry(Point, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_huc_labels_run_id_idx
  ON environmental_current.hydro_huc_labels (run_id);

CREATE INDEX IF NOT EXISTS hydro_huc_labels_level_idx
  ON environmental_current.hydro_huc_labels (huc_level);

CREATE INDEX IF NOT EXISTS hydro_huc_labels_geom_3857_gist_idx
  ON environmental_current.hydro_huc_labels USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS environmental_tiles.hydro_polygon_source (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE CASCADE,
  huc_level integer NOT NULL,
  huc text,
  name text,
  areasqkm double precision,
  states text,
  data_version text NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_polygon_source_run_id_idx
  ON environmental_tiles.hydro_polygon_source (run_id);

CREATE INDEX IF NOT EXISTS hydro_polygon_source_level_idx
  ON environmental_tiles.hydro_polygon_source (huc_level);

CREATE INDEX IF NOT EXISTS hydro_polygon_source_geom_3857_gist_idx
  ON environmental_tiles.hydro_polygon_source USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS environmental_tiles.hydro_line_source (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE CASCADE,
  huc_level integer NOT NULL,
  data_version text NOT NULL,
  geom_3857 geometry(MultiLineString, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_line_source_run_id_idx
  ON environmental_tiles.hydro_line_source (run_id);

CREATE INDEX IF NOT EXISTS hydro_line_source_level_idx
  ON environmental_tiles.hydro_line_source (huc_level);

CREATE INDEX IF NOT EXISTS hydro_line_source_geom_3857_gist_idx
  ON environmental_tiles.hydro_line_source USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS environmental_tiles.hydro_label_source (
  feature_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id text NOT NULL REFERENCES environmental_meta.hydro_runs(run_id) ON DELETE CASCADE,
  huc_level integer NOT NULL,
  huc text,
  name text,
  areasqkm double precision,
  label_rank double precision,
  states text,
  data_version text NOT NULL,
  geom_3857 geometry(Point, 3857) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hydro_label_source_run_id_idx
  ON environmental_tiles.hydro_label_source (run_id);

CREATE INDEX IF NOT EXISTS hydro_label_source_level_idx
  ON environmental_tiles.hydro_label_source (huc_level);

CREATE INDEX IF NOT EXISTS hydro_label_source_geom_3857_gist_idx
  ON environmental_tiles.hydro_label_source USING gist (geom_3857);

COMMIT;
