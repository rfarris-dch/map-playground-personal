BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics_meta;

CREATE TABLE IF NOT EXISTS analytics_meta.county_adjacency_publication (
  publication_key text PRIMARY KEY,
  published_relation_name text NOT NULL,
  boundary_relation_name text NOT NULL,
  source_relation_name text NOT NULL,
  boundary_version text NOT NULL,
  source_row_count integer NOT NULL,
  published_row_count integer NOT NULL,
  source_refreshed_at timestamptz NOT NULL,
  source_as_of_date date,
  artifact_relative_path text NOT NULL,
  artifact_absolute_path text NOT NULL,
  run_id text NOT NULL,
  model_version text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS county_adjacency_publication_boundary_version_idx
  ON analytics_meta.county_adjacency_publication (boundary_version, published_at DESC);

CREATE INDEX IF NOT EXISTS county_adjacency_publication_run_id_idx
  ON analytics_meta.county_adjacency_publication (run_id, published_at DESC);

COMMIT;
