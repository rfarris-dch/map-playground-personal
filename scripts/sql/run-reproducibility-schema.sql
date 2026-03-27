BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics_meta;

CREATE TABLE IF NOT EXISTS analytics_meta.run_reproducibility_envelope (
  surface_scope text NOT NULL CHECK (surface_scope IN ('county', 'corridor', 'parcel')),
  run_kind text NOT NULL CHECK (run_kind IN ('publication', 'analysis', 'replay')),
  run_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'failed', 'replayed')),
  envelope_version text NOT NULL,
  registry_version text,
  model_version text,
  formula_version text,
  methodology_id text,
  data_version text,
  effective_date date,
  month date,
  run_recorded_at timestamptz NOT NULL,
  replayed_from_run_id text,
  replayability_tier text NOT NULL CHECK (
    replayability_tier IN ('strict', 'best_effort', 'not_replayable')
  ),
  config_hash text NOT NULL,
  code_hash text NOT NULL,
  input_state_hash text NOT NULL,
  envelope_hash text NOT NULL,
  output_hash text,
  source_version_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ingestion_snapshot_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  downstream_objects_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_tables_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  code_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifact_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (surface_scope, run_kind, run_id)
);

CREATE INDEX IF NOT EXISTS run_reproducibility_envelope_recorded_at_idx
  ON analytics_meta.run_reproducibility_envelope (surface_scope, run_recorded_at DESC);

CREATE INDEX IF NOT EXISTS run_reproducibility_envelope_replayed_from_idx
  ON analytics_meta.run_reproducibility_envelope (surface_scope, replayed_from_run_id);

CREATE TABLE IF NOT EXISTS analytics_meta.run_reproducibility_source_snapshot (
  surface_scope text NOT NULL CHECK (surface_scope IN ('county', 'corridor', 'parcel')),
  run_kind text NOT NULL CHECK (run_kind IN ('publication', 'analysis', 'replay')),
  run_id text NOT NULL,
  source_id text NOT NULL,
  source_version_id text,
  provider_version_label text,
  source_as_of_date date,
  freshness_as_of timestamptz,
  staleness_state text CHECK (staleness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  ingestion_health text,
  access_status text,
  runtime_alert_state text,
  last_successful_ingest_at timestamptz,
  latest_provider_update_seen_at timestamptz,
  record_count integer,
  completeness_observed numeric(6, 5),
  geographic_coverage_observed numeric(6, 5),
  license_expiration_date date,
  runtime_state_hash text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (surface_scope, run_kind, run_id, source_id),
  FOREIGN KEY (surface_scope, run_kind, run_id)
    REFERENCES analytics_meta.run_reproducibility_envelope (surface_scope, run_kind, run_id)
      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS run_reproducibility_source_snapshot_version_idx
  ON analytics_meta.run_reproducibility_source_snapshot (surface_scope, source_version_id);

CREATE TABLE IF NOT EXISTS analytics_meta.run_reproducibility_input_snapshot (
  surface_scope text NOT NULL CHECK (surface_scope IN ('county', 'corridor', 'parcel')),
  run_kind text NOT NULL CHECK (run_kind IN ('publication', 'analysis', 'replay')),
  run_id text NOT NULL,
  snapshot_kind text NOT NULL,
  snapshot_id text NOT NULL,
  source_id text,
  source_version_id text,
  manifest_path text,
  manifest_hash text,
  storage_uri text,
  effective_date date,
  data_version text,
  replay_mode text NOT NULL CHECK (
    replay_mode IN ('strict_input', 'self_snapshot', 'best_effort_pointer')
  ),
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (surface_scope, run_kind, run_id, snapshot_kind, snapshot_id),
  FOREIGN KEY (surface_scope, run_kind, run_id)
    REFERENCES analytics_meta.run_reproducibility_envelope (surface_scope, run_kind, run_id)
      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS run_reproducibility_input_snapshot_kind_idx
  ON analytics_meta.run_reproducibility_input_snapshot (surface_scope, snapshot_kind);

DROP VIEW IF EXISTS analytics_meta.v_run_reproducibility_summary;

CREATE VIEW analytics_meta.v_run_reproducibility_summary AS
WITH source_counts AS (
  SELECT
    snapshot.surface_scope,
    snapshot.run_kind,
    snapshot.run_id,
    COUNT(*)::integer AS source_version_count
  FROM analytics_meta.run_reproducibility_source_snapshot AS snapshot
  GROUP BY snapshot.surface_scope, snapshot.run_kind, snapshot.run_id
),
input_counts AS (
  SELECT
    snapshot.surface_scope,
    snapshot.run_kind,
    snapshot.run_id,
    COUNT(*)::integer AS ingestion_snapshot_count
  FROM analytics_meta.run_reproducibility_input_snapshot AS snapshot
  GROUP BY snapshot.surface_scope, snapshot.run_kind, snapshot.run_id
)
SELECT
  envelope.surface_scope,
  envelope.run_kind,
  envelope.run_id,
  envelope.status,
  envelope.envelope_version,
  envelope.registry_version,
  envelope.model_version,
  envelope.formula_version,
  envelope.methodology_id,
  envelope.data_version,
  envelope.effective_date,
  envelope.month,
  envelope.run_recorded_at,
  envelope.replayed_from_run_id,
  envelope.replayability_tier,
  envelope.config_hash,
  envelope.code_hash,
  envelope.input_state_hash,
  envelope.envelope_hash,
  envelope.output_hash,
  COALESCE(source_counts.source_version_count, 0) AS source_version_count,
  COALESCE(input_counts.ingestion_snapshot_count, 0) AS ingestion_snapshot_count,
  envelope.output_counts_json,
  envelope.artifact_refs_json
FROM analytics_meta.run_reproducibility_envelope AS envelope
LEFT JOIN source_counts
  ON source_counts.surface_scope = envelope.surface_scope
  AND source_counts.run_kind = envelope.run_kind
  AND source_counts.run_id = envelope.run_id
LEFT JOIN input_counts
  ON input_counts.surface_scope = envelope.surface_scope
  AND input_counts.run_kind = envelope.run_kind
  AND input_counts.run_id = envelope.run_id;

COMMENT ON VIEW analytics_meta.v_run_reproducibility_summary
  IS 'Cross-surface run reproducibility summary with source/input snapshot counts and reproducibility hashes.';

COMMIT;
