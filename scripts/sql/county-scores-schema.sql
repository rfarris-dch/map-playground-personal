BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS analytics_meta;

CREATE TABLE IF NOT EXISTS analytics.dim_county (
  county_geoid text PRIMARY KEY,
  county_name text NOT NULL,
  state_abbrev text NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL,
  centroid geometry(Point, 4326) NOT NULL,
  centroid_3857 geometry(Point, 3857) NOT NULL,
  area_sqkm numeric(14, 4),
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  CONSTRAINT dim_county_geoid_check CHECK (county_geoid ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS dim_county_state_idx ON analytics.dim_county (state_abbrev);
CREATE INDEX IF NOT EXISTS dim_county_geom_gist ON analytics.dim_county USING gist (geom_3857);

CREATE TABLE IF NOT EXISTS analytics.bridge_county_adjacency (
  county_geoid text NOT NULL,
  adjacent_county_geoid text NOT NULL,
  shared_boundary_meters numeric(14, 2) NOT NULL DEFAULT 0,
  point_touch boolean NOT NULL DEFAULT false,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, adjacent_county_geoid),
  CONSTRAINT bridge_county_adjacency_county_check CHECK (county_geoid ~ '^[0-9]{5}$'),
  CONSTRAINT bridge_county_adjacency_adjacent_check CHECK (adjacent_county_geoid ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS bridge_county_adjacency_adjacent_idx
  ON analytics.bridge_county_adjacency (adjacent_county_geoid);

CREATE TABLE IF NOT EXISTS analytics.bridge_county_market (
  county_geoid text NOT NULL,
  market_id text NOT NULL,
  county_overlap_pct numeric(8, 6) NOT NULL,
  market_overlap_pct numeric(8, 6) NOT NULL,
  is_primary_market boolean NOT NULL DEFAULT false,
  is_seam_county boolean NOT NULL DEFAULT false,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, market_id),
  CONSTRAINT bridge_county_market_county_check CHECK (county_geoid ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS bridge_county_market_primary_idx
  ON analytics.bridge_county_market (is_primary_market, market_id);

CREATE TABLE IF NOT EXISTS analytics.fact_dc_pipeline_project (
  project_id text PRIMARY KEY,
  source_system text NOT NULL,
  project_type text NOT NULL,
  provider_id text,
  provider_label text,
  project_name text NOT NULL,
  county_geoid text,
  state_abbrev text,
  first_seen_at timestamptz NOT NULL,
  latest_source_as_of_date date,
  latest_source_pull_ts timestamptz,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_dc_pipeline_project_county_idx
  ON analytics.fact_dc_pipeline_project (county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_dc_pipeline_snapshot (
  publication_run_id text NOT NULL,
  project_id text NOT NULL,
  source_system text NOT NULL,
  project_type text NOT NULL,
  provider_id text,
  provider_label text,
  project_name text NOT NULL,
  county_geoid text,
  state_abbrev text,
  commissioned_semantic text NOT NULL,
  commissioned_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  planned_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  under_construction_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  available_power_mw numeric(12, 2),
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (publication_run_id, project_id)
);

CREATE INDEX IF NOT EXISTS fact_dc_pipeline_snapshot_effective_idx
  ON analytics.fact_dc_pipeline_snapshot (effective_date DESC, county_geoid);
CREATE INDEX IF NOT EXISTS fact_dc_pipeline_snapshot_county_idx
  ON analytics.fact_dc_pipeline_snapshot (county_geoid, publication_run_id);

CREATE TABLE IF NOT EXISTS analytics.fact_gen_queue_project (
  project_id text PRIMARY KEY,
  source_system text NOT NULL,
  queue_name text,
  market_id text,
  county_geoid text,
  state_abbrev text,
  fuel_type text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  latest_source_as_of_date date,
  latest_source_pull_ts timestamptz,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_gen_queue_project_county_idx
  ON analytics.fact_gen_queue_project (county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_gen_queue_snapshot (
  snapshot_run_id text NOT NULL,
  project_id text NOT NULL,
  source_system text NOT NULL,
  county_geoid text,
  market_id text,
  state_abbrev text,
  queue_status text,
  signed_ia boolean,
  capacity_mw numeric(12, 2),
  queue_date date,
  expected_operation_date date,
  days_in_queue_active integer,
  is_past_due boolean,
  completion_prior numeric(8, 6),
  withdrawal_prior numeric(8, 6),
  transmission_upgrade_count integer,
  transmission_upgrade_cost_usd numeric(18, 2),
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (snapshot_run_id, project_id)
);

CREATE INDEX IF NOT EXISTS fact_gen_queue_snapshot_effective_idx
  ON analytics.fact_gen_queue_snapshot (effective_date DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_generation_realized_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  operable_mw numeric(12, 2),
  proposed_mw numeric(12, 2),
  retired_mw numeric(12, 2),
  source_dataset text NOT NULL,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month, source_dataset)
);

CREATE INDEX IF NOT EXISTS fact_generation_realized_snapshot_month_idx
  ON analytics.fact_generation_realized_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_grid_friction_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  median_days_in_queue_active numeric(12, 2),
  past_due_share numeric(8, 6),
  status_mix_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  market_withdrawal_prior numeric(8, 6),
  congestion_proxy_score numeric(8, 4),
  planned_transmission_upgrade_count integer,
  heatmap_signal_available boolean,
  confidence text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_grid_friction_snapshot_month_idx
  ON analytics.fact_grid_friction_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_policy_event (
  event_id text PRIMARY KEY,
  county_geoid text,
  state_abbrev text,
  market_id text,
  event_type text NOT NULL,
  event_date date NOT NULL,
  title text NOT NULL,
  evidence_summary text NOT NULL,
  source_url text,
  moratorium_status text,
  sentiment_direction text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_policy_event_county_idx
  ON analytics.fact_policy_event (county_geoid, event_date DESC);

CREATE TABLE IF NOT EXISTS analytics.fact_policy_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  policy_constraint_score numeric(8, 4),
  policy_momentum_score numeric(8, 4),
  moratorium_status text,
  public_sentiment_score numeric(8, 4),
  policy_event_count integer,
  county_tagged_event_share numeric(8, 6),
  policy_mapping_confidence text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_policy_snapshot_month_idx
  ON analytics.fact_policy_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_gas_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  gas_pipeline_presence_flag boolean,
  gas_pipeline_mileage_county numeric(12, 2),
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_gas_snapshot_month_idx
  ON analytics.fact_gas_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_market_analysis_score_snapshot (
  publication_run_id text NOT NULL,
  county_geoid text NOT NULL,
  county_name text NOT NULL,
  state_abbrev text NOT NULL,
  rank_status text NOT NULL,
  attractiveness_tier text NOT NULL,
  confidence_badge text NOT NULL,
  market_pressure_index numeric(8, 4),
  demand_pressure_score numeric(8, 4),
  supply_timeline_score numeric(8, 4),
  grid_friction_score numeric(8, 4),
  policy_constraint_score numeric(8, 4),
  freshness_score numeric(8, 4),
  source_volatility text NOT NULL,
  last_updated_at timestamptz,
  narrative_summary text,
  top_drivers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  deferred_reason_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_30d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_60d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_90d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  pillar_value_states_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_mw_0_24m numeric(12, 2),
  expected_mw_24_60m numeric(12, 2),
  recent_commissioned_mw_24m numeric(12, 2),
  demand_momentum_qoq numeric(12, 4),
  provider_entry_count_12m integer,
  expected_supply_mw_0_36m numeric(12, 2),
  expected_supply_mw_36_60m numeric(12, 2),
  signed_ia_mw numeric(12, 2),
  queue_mw_active numeric(12, 2),
  queue_project_count_active integer,
  median_days_in_queue_active numeric(12, 2),
  past_due_share numeric(8, 6),
  market_withdrawal_prior numeric(8, 6),
  congestion_proxy_score numeric(8, 4),
  planned_upgrade_count integer,
  heatmap_signal_flag boolean,
  policy_momentum_score numeric(8, 4),
  moratorium_status text NOT NULL,
  public_sentiment_score numeric(8, 4),
  policy_event_count integer,
  county_tagged_event_share numeric(8, 6),
  policy_mapping_confidence text,
  transmission_miles_69kv_plus numeric(12, 2),
  transmission_miles_230kv_plus numeric(12, 2),
  gas_pipeline_presence_flag boolean,
  gas_pipeline_mileage_county numeric(12, 2),
  fiber_presence_flag boolean,
  water_stress_score numeric(8, 4),
  primary_market_id text,
  is_seam_county boolean NOT NULL DEFAULT false,
  formula_version text NOT NULL,
  input_data_version text NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_run_id, county_geoid)
);

CREATE INDEX IF NOT EXISTS fact_market_analysis_score_snapshot_publication_idx
  ON analytics.fact_market_analysis_score_snapshot (publication_run_id, rank_status, market_pressure_index DESC);

COMMENT ON COLUMN analytics.fact_market_analysis_score_snapshot.water_stress_score
  IS 'Deprecated storage-only field retained for backward-compatible live tables; the county score API no longer publishes water stress.';

CREATE TABLE IF NOT EXISTS analytics.fact_narrative_snapshot (
  publication_run_id text NOT NULL,
  county_geoid text NOT NULL,
  narrative_summary text NOT NULL,
  narrative_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_run_id, county_geoid)
);

CREATE TABLE IF NOT EXISTS analytics.fact_publication (
  publication_run_id text PRIMARY KEY,
  status text NOT NULL,
  model_version text NOT NULL,
  methodology_id text NOT NULL,
  formula_version text NOT NULL,
  data_version text NOT NULL,
  input_data_version text NOT NULL,
  source_versions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_feature_families text[] NOT NULL DEFAULT '{}'::text[],
  missing_feature_families text[] NOT NULL DEFAULT '{}'::text[],
  source_county_count integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  ranked_county_count integer NOT NULL DEFAULT 0,
  deferred_county_count integer NOT NULL DEFAULT 0,
  blocked_county_count integer NOT NULL DEFAULT 0,
  high_confidence_count integer NOT NULL DEFAULT 0,
  medium_confidence_count integer NOT NULL DEFAULT 0,
  low_confidence_count integer NOT NULL DEFAULT 0,
  fresh_county_count integer NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  as_of_date date,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS fact_publication_published_at_idx
  ON analytics.fact_publication (published_at DESC);

CREATE TABLE IF NOT EXISTS analytics.county_market_pressure_current (
  county_geoid text PRIMARY KEY,
  county_name text NOT NULL,
  state_abbrev text NOT NULL,
  publication_run_id text NOT NULL,
  rank_status text NOT NULL,
  attractiveness_tier text NOT NULL,
  confidence_badge text NOT NULL,
  market_pressure_index numeric(8, 4),
  demand_pressure_score numeric(8, 4),
  supply_timeline_score numeric(8, 4),
  grid_friction_score numeric(8, 4),
  policy_constraint_score numeric(8, 4),
  freshness_score numeric(8, 4),
  source_volatility text NOT NULL,
  last_updated_at timestamptz,
  narrative_summary text,
  top_drivers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  deferred_reason_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_30d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_60d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_changed_90d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  pillar_value_states_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_mw_0_24m numeric(12, 2),
  expected_mw_24_60m numeric(12, 2),
  recent_commissioned_mw_24m numeric(12, 2),
  demand_momentum_qoq numeric(12, 4),
  provider_entry_count_12m integer,
  expected_supply_mw_0_36m numeric(12, 2),
  expected_supply_mw_36_60m numeric(12, 2),
  signed_ia_mw numeric(12, 2),
  queue_mw_active numeric(12, 2),
  queue_project_count_active integer,
  median_days_in_queue_active numeric(12, 2),
  past_due_share numeric(8, 6),
  market_withdrawal_prior numeric(8, 6),
  congestion_proxy_score numeric(8, 4),
  planned_upgrade_count integer,
  heatmap_signal_flag boolean,
  policy_momentum_score numeric(8, 4),
  moratorium_status text NOT NULL,
  public_sentiment_score numeric(8, 4),
  policy_event_count integer,
  county_tagged_event_share numeric(8, 6),
  policy_mapping_confidence text,
  transmission_miles_69kv_plus numeric(12, 2),
  transmission_miles_230kv_plus numeric(12, 2),
  gas_pipeline_presence_flag boolean,
  gas_pipeline_mileage_county numeric(12, 2),
  fiber_presence_flag boolean,
  water_stress_score numeric(8, 4),
  primary_market_id text,
  is_seam_county boolean NOT NULL DEFAULT false,
  formula_version text NOT NULL,
  input_data_version text NOT NULL,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS county_market_pressure_current_rank_idx
  ON analytics.county_market_pressure_current (rank_status, market_pressure_index DESC);

COMMENT ON COLUMN analytics.county_market_pressure_current.water_stress_score
  IS 'Deprecated storage-only field retained for backward-compatible live tables; the county score API no longer publishes water stress.';

COMMIT;
