BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS parcel_meta;
CREATE SCHEMA IF NOT EXISTS parcel_current;

DO $$
DECLARE
  run_id_data_type text;
BEGIN
  SELECT c.data_type
  INTO run_id_data_type
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'parcel_meta'
    AND c.table_name = 'ingestion_runs'
    AND c.column_name = 'run_id';

  IF run_id_data_type = 'uuid' THEN
    DROP TABLE IF EXISTS parcel_meta.ingestion_checkpoints;
    DROP TABLE IF EXISTS parcel_meta.ingestion_runs;
  END IF;
END
$$;

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
  parcel_id text NOT NULL,
  source_oid bigint,
  state2 text,
  geoid text,
  source_updated_at timestamptz,
  ingestion_run_id text NOT NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  PRIMARY KEY (parcel_id)
);

CREATE INDEX IF NOT EXISTS parcels_source_oid_idx
  ON parcel_current.parcels (source_oid);

CREATE INDEX IF NOT EXISTS parcels_state2_idx
  ON parcel_current.parcels (state2);

CREATE INDEX IF NOT EXISTS parcels_geoid_idx
  ON parcel_current.parcels (geoid);

CREATE INDEX IF NOT EXISTS parcels_geom_3857_gist_idx
  ON parcel_current.parcels USING gist (geom_3857);

CREATE INDEX IF NOT EXISTS parcels_attrs_gin_idx
  ON parcel_current.parcels USING gin (attrs jsonb_path_ops);

COMMIT;
