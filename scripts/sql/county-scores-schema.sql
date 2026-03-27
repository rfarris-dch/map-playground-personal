BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS analytics_meta;
CREATE SCHEMA IF NOT EXISTS serve;

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

CREATE TABLE IF NOT EXISTS analytics.dim_operator_region (
  operator_region text NOT NULL,
  market_structure text NOT NULL,
  source_artifact text NOT NULL,
  source_version text,
  mapping_method text NOT NULL,
  confidence_class text NOT NULL,
  owner text NOT NULL DEFAULT 'county-power-public-us',
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, operator_region)
);

CREATE INDEX IF NOT EXISTS dim_operator_region_effective_idx
  ON analytics.dim_operator_region (effective_date DESC, operator_region);

CREATE TABLE IF NOT EXISTS analytics.bridge_county_operator_region (
  county_geoid text NOT NULL,
  operator_region text NOT NULL,
  market_structure text NOT NULL,
  allocation_share numeric(8, 6) NOT NULL DEFAULT 1,
  is_primary_region boolean NOT NULL DEFAULT true,
  is_border_county boolean NOT NULL DEFAULT false,
  is_seam_county boolean NOT NULL DEFAULT false,
  source_artifact text NOT NULL,
  source_version text,
  mapping_method text NOT NULL,
  confidence_class text NOT NULL,
  owner text NOT NULL DEFAULT 'county-power-public-us',
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, county_geoid, operator_region)
);

CREATE INDEX IF NOT EXISTS bridge_county_operator_region_effective_idx
  ON analytics.bridge_county_operator_region (effective_date DESC, county_geoid, operator_region);

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
  native_status text,
  stage_group text,
  queue_county_confidence text,
  queue_poi_label text,
  queue_resolver_type text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  latest_source_as_of_date date,
  latest_source_pull_ts timestamptz,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_gen_queue_project_county_idx
  ON analytics.fact_gen_queue_project (county_geoid);

ALTER TABLE IF EXISTS analytics.fact_gen_queue_project
  ADD COLUMN IF NOT EXISTS native_status text,
  ADD COLUMN IF NOT EXISTS stage_group text,
  ADD COLUMN IF NOT EXISTS queue_county_confidence text,
  ADD COLUMN IF NOT EXISTS queue_poi_label text,
  ADD COLUMN IF NOT EXISTS queue_resolver_type text;

CREATE TABLE IF NOT EXISTS analytics.fact_gen_queue_county_resolution (
  project_id text NOT NULL,
  county_geoid text NOT NULL,
  source_system text NOT NULL,
  market_id text,
  state_abbrev text,
  allocation_share numeric(8, 6) NOT NULL,
  resolver_type text NOT NULL,
  resolver_confidence text NOT NULL,
  queue_poi_label text,
  source_location_label text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, project_id, county_geoid)
);

CREATE INDEX IF NOT EXISTS fact_gen_queue_county_resolution_effective_idx
  ON analytics.fact_gen_queue_county_resolution (effective_date DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_gen_queue_unresolved (
  effective_date date NOT NULL,
  project_id text NOT NULL,
  source_system text NOT NULL,
  market_id text,
  state_abbrev text,
  queue_name text,
  queue_poi_label text,
  raw_location_label text,
  native_status text,
  unresolved_reason text NOT NULL,
  candidate_counties_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_review_flag boolean NOT NULL DEFAULT true,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, project_id)
);

CREATE INDEX IF NOT EXISTS fact_gen_queue_unresolved_effective_idx
  ON analytics.fact_gen_queue_unresolved (effective_date DESC, source_system);

CREATE TABLE IF NOT EXISTS analytics.fact_queue_resolution_override (
  source_system text NOT NULL,
  matcher_type text NOT NULL,
  matcher_value text NOT NULL,
  county_geoid text NOT NULL,
  state_abbrev text,
  allocation_share numeric(8, 6) NOT NULL,
  resolver_type text NOT NULL,
  resolver_confidence text NOT NULL,
  notes text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, source_system, matcher_type, matcher_value, county_geoid)
);

CREATE INDEX IF NOT EXISTS fact_queue_resolution_override_effective_idx
  ON analytics.fact_queue_resolution_override (effective_date DESC, source_system, matcher_type);

CREATE TABLE IF NOT EXISTS analytics.dim_queue_poi_reference (
  source_system text NOT NULL,
  queue_poi_label text NOT NULL,
  county_geoid text NOT NULL,
  state_abbrev text,
  wholesale_operator text,
  operator_zone_label text,
  operator_zone_type text,
  resolution_method text NOT NULL,
  resolver_confidence text NOT NULL,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, source_system, queue_poi_label, county_geoid)
);

CREATE INDEX IF NOT EXISTS dim_queue_poi_reference_effective_idx
  ON analytics.dim_queue_poi_reference (effective_date DESC, source_system, queue_poi_label);

CREATE TABLE IF NOT EXISTS analytics.dim_county_fips_alias (
  alias_county_geoid text NOT NULL,
  canonical_county_geoid text NOT NULL,
  alias_kind text NOT NULL,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, alias_county_geoid, canonical_county_geoid)
);

CREATE INDEX IF NOT EXISTS dim_county_fips_alias_effective_idx
  ON analytics.dim_county_fips_alias (effective_date DESC, alias_county_geoid);

CREATE TABLE IF NOT EXISTS analytics.dim_operator_zone_reference (
  wholesale_operator text NOT NULL,
  operator_zone_label text NOT NULL,
  operator_zone_type text NOT NULL,
  state_abbrev text,
  reference_name text,
  resolution_method text NOT NULL,
  operator_zone_confidence text,
  source_artifact text,
  source_version text,
  confidence_class text,
  owner text NOT NULL DEFAULT 'county-power-public-us',
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (effective_date, wholesale_operator, operator_zone_label, operator_zone_type)
);

CREATE INDEX IF NOT EXISTS dim_operator_zone_reference_effective_idx
  ON analytics.dim_operator_zone_reference (
    effective_date DESC,
    wholesale_operator,
    operator_zone_label
  );

ALTER TABLE IF EXISTS analytics.dim_operator_zone_reference
  ADD COLUMN IF NOT EXISTS source_artifact text,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS confidence_class text,
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'county-power-public-us';

CREATE TABLE IF NOT EXISTS analytics.bridge_county_operator_zone (
  county_geoid text NOT NULL,
  wholesale_operator text NOT NULL,
  operator_zone_label text NOT NULL,
  operator_zone_type text NOT NULL,
  operator_zone_confidence text,
  resolution_method text NOT NULL,
  allocation_share numeric(8, 6) NOT NULL DEFAULT 1,
  is_primary_subregion boolean NOT NULL DEFAULT true,
  source_artifact text,
  source_version text,
  confidence_class text,
  owner text NOT NULL DEFAULT 'county-power-public-us',
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (
    effective_date,
    county_geoid,
    wholesale_operator,
    operator_zone_label,
    operator_zone_type
  )
);

CREATE INDEX IF NOT EXISTS bridge_county_operator_zone_effective_idx
  ON analytics.bridge_county_operator_zone (
    effective_date DESC,
    county_geoid,
    wholesale_operator
  );

ALTER TABLE IF EXISTS analytics.bridge_county_operator_zone
  ADD COLUMN IF NOT EXISTS is_primary_subregion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_artifact text,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS confidence_class text,
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'county-power-public-us';

CREATE TABLE IF NOT EXISTS analytics.fact_gen_queue_snapshot (
  snapshot_run_id text NOT NULL,
  project_id text NOT NULL,
  source_system text NOT NULL,
  county_geoid text,
  market_id text,
  state_abbrev text,
  native_status text,
  queue_status text,
  stage_group text,
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

ALTER TABLE IF EXISTS analytics.fact_gen_queue_snapshot
  ADD COLUMN IF NOT EXISTS native_status text,
  ADD COLUMN IF NOT EXISTS stage_group text;

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
  jurisdiction_level text,
  jurisdiction_key text,
  event_type text NOT NULL,
  policy_type text,
  policy_status text,
  policy_direction text,
  affected_siting_dimension text,
  event_date date NOT NULL,
  title text NOT NULL,
  evidence_summary text NOT NULL,
  source_url text,
  moratorium_status text,
  sentiment_direction text,
  confidence_class text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_policy_event_county_idx
  ON analytics.fact_policy_event (county_geoid, event_date DESC);

ALTER TABLE IF EXISTS analytics.fact_policy_event
  ADD COLUMN IF NOT EXISTS jurisdiction_level text,
  ADD COLUMN IF NOT EXISTS jurisdiction_key text,
  ADD COLUMN IF NOT EXISTS policy_type text,
  ADD COLUMN IF NOT EXISTS policy_status text,
  ADD COLUMN IF NOT EXISTS policy_direction text,
  ADD COLUMN IF NOT EXISTS affected_siting_dimension text,
  ADD COLUMN IF NOT EXISTS confidence_class text;

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

CREATE TABLE IF NOT EXISTS analytics.fact_fiber_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  fiber_presence_flag boolean,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_fiber_snapshot_month_idx
  ON analytics.fact_fiber_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_power_market_context_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  wholesale_operator text,
  market_structure text,
  balancing_authority text,
  load_zone text,
  weather_zone text,
  operator_zone_label text,
  operator_zone_type text,
  operator_zone_confidence text,
  operator_weather_zone text,
  meteo_zone text,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_power_market_context_snapshot_month_idx
  ON analytics.fact_power_market_context_snapshot (month DESC, county_geoid);

ALTER TABLE IF EXISTS analytics.fact_power_market_context_snapshot
  ADD COLUMN IF NOT EXISTS operator_zone_label text,
  ADD COLUMN IF NOT EXISTS operator_zone_type text,
  ADD COLUMN IF NOT EXISTS operator_zone_confidence text,
  ADD COLUMN IF NOT EXISTS operator_weather_zone text,
  ADD COLUMN IF NOT EXISTS meteo_zone text;

CREATE TABLE IF NOT EXISTS analytics.fact_utility_context_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  retail_choice_status text,
  competitive_area_type text,
  primary_tdu_or_utility text,
  dominant_utility_id text,
  dominant_utility_name text,
  retail_choice_penetration_share numeric(8, 6),
  territory_type text,
  utility_count integer,
  utilities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_utility_context_snapshot_month_idx
  ON analytics.fact_utility_context_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_transmission_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  transmission_miles_69kv_plus numeric(12, 2),
  transmission_miles_138kv_plus numeric(12, 2),
  transmission_miles_230kv_plus numeric(12, 2),
  transmission_miles_345kv_plus numeric(12, 2),
  transmission_miles_500kv_plus numeric(12, 2),
  transmission_miles_765kv_plus numeric(12, 2),
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_transmission_snapshot_month_idx
  ON analytics.fact_transmission_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_congestion_snapshot (
  county_geoid text NOT NULL,
  month date NOT NULL,
  avg_rt_congestion_component numeric(12, 4),
  p95_shadow_price numeric(12, 4),
  negative_price_hour_share numeric(8, 6),
  top_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_pull_ts timestamptz NOT NULL,
  source_as_of_date date,
  effective_date date NOT NULL,
  model_version text NOT NULL,
  PRIMARY KEY (county_geoid, month)
);

CREATE INDEX IF NOT EXISTS fact_congestion_snapshot_month_idx
  ON analytics.fact_congestion_snapshot (month DESC, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.fact_market_analysis_score_snapshot (
  publication_run_id text NOT NULL,
  county_geoid text NOT NULL,
  county_name text NOT NULL,
  state_abbrev text NOT NULL,
  rank_status text NOT NULL,
  attractiveness_tier text NOT NULL,
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
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
  wholesale_operator text,
  market_structure text,
  balancing_authority text,
  load_zone text,
  weather_zone text,
  operator_zone_label text,
  operator_zone_type text,
  operator_zone_confidence text,
  operator_weather_zone text,
  meteo_zone text,
  retail_choice_status text,
  competitive_area_type text,
  transmission_miles_69kv_plus numeric(12, 2),
  transmission_miles_138kv_plus numeric(12, 2),
  transmission_miles_230kv_plus numeric(12, 2),
  transmission_miles_345kv_plus numeric(12, 2),
  transmission_miles_500kv_plus numeric(12, 2),
  transmission_miles_765kv_plus numeric(12, 2),
  gas_pipeline_presence_flag boolean,
  gas_pipeline_mileage_county numeric(12, 2),
  fiber_presence_flag boolean,
  water_stress_score numeric(8, 4),
  primary_market_id text,
  primary_tdu_or_utility text,
  utility_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_border_county boolean NOT NULL DEFAULT false,
  is_seam_county boolean NOT NULL DEFAULT false,
  queue_storage_mw numeric(12, 2),
  queue_solar_mw numeric(12, 2),
  queue_wind_mw numeric(12, 2),
  queue_avg_age_days numeric(12, 2),
  queue_withdrawal_rate numeric(8, 6),
  recent_online_mw numeric(12, 2),
  avg_rt_congestion_component numeric(12, 4),
  p95_shadow_price numeric(12, 4),
  negative_price_hour_share numeric(8, 6),
  top_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
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

ALTER TABLE IF EXISTS analytics.fact_market_analysis_score_snapshot
  ADD COLUMN IF NOT EXISTS evidence_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS method_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS coverage_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS freshness_state text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS suppression_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS wholesale_operator text,
  ADD COLUMN IF NOT EXISTS market_structure text,
  ADD COLUMN IF NOT EXISTS balancing_authority text,
  ADD COLUMN IF NOT EXISTS load_zone text,
  ADD COLUMN IF NOT EXISTS weather_zone text,
  ADD COLUMN IF NOT EXISTS operator_zone_label text,
  ADD COLUMN IF NOT EXISTS operator_zone_type text,
  ADD COLUMN IF NOT EXISTS operator_zone_confidence text,
  ADD COLUMN IF NOT EXISTS operator_weather_zone text,
  ADD COLUMN IF NOT EXISTS meteo_zone text,
  ADD COLUMN IF NOT EXISTS retail_choice_status text,
  ADD COLUMN IF NOT EXISTS competitive_area_type text,
  ADD COLUMN IF NOT EXISTS transmission_miles_69kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_138kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_230kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_345kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_500kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_765kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS primary_tdu_or_utility text,
  ADD COLUMN IF NOT EXISTS utility_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_border_county boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_storage_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_solar_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_wind_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_avg_age_days numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_withdrawal_rate numeric(8, 6),
  ADD COLUMN IF NOT EXISTS recent_online_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS avg_rt_congestion_component numeric(12, 4),
  ADD COLUMN IF NOT EXISTS p95_shadow_price numeric(12, 4),
  ADD COLUMN IF NOT EXISTS negative_price_hour_share numeric(8, 6),
  ADD COLUMN IF NOT EXISTS top_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb;

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
  registry_version text,
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
  freshness_fresh_count integer NOT NULL DEFAULT 0,
  freshness_aging_count integer NOT NULL DEFAULT 0,
  freshness_stale_count integer NOT NULL DEFAULT 0,
  freshness_critical_count integer NOT NULL DEFAULT 0,
  freshness_unknown_count integer NOT NULL DEFAULT 0,
  suppression_none_count integer NOT NULL DEFAULT 0,
  suppression_downgraded_count integer NOT NULL DEFAULT 0,
  suppression_review_required_count integer NOT NULL DEFAULT 0,
  suppression_suppressed_count integer NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  as_of_date date,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS fact_publication_published_at_idx
  ON analytics.fact_publication (published_at DESC);

ALTER TABLE IF EXISTS analytics.fact_publication
  ADD COLUMN IF NOT EXISTS registry_version text,
  ADD COLUMN IF NOT EXISTS freshness_fresh_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freshness_aging_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freshness_stale_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freshness_critical_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freshness_unknown_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suppression_none_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suppression_downgraded_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suppression_review_required_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suppression_suppressed_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS analytics.county_market_pressure_current (
  county_geoid text PRIMARY KEY,
  county_name text NOT NULL,
  state_abbrev text NOT NULL,
  publication_run_id text NOT NULL,
  rank_status text NOT NULL,
  attractiveness_tier text NOT NULL,
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
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
  wholesale_operator text,
  market_structure text,
  balancing_authority text,
  load_zone text,
  weather_zone text,
  operator_zone_label text,
  operator_zone_type text,
  operator_zone_confidence text,
  operator_weather_zone text,
  meteo_zone text,
  retail_choice_status text,
  competitive_area_type text,
  transmission_miles_69kv_plus numeric(12, 2),
  transmission_miles_138kv_plus numeric(12, 2),
  transmission_miles_230kv_plus numeric(12, 2),
  transmission_miles_345kv_plus numeric(12, 2),
  transmission_miles_500kv_plus numeric(12, 2),
  transmission_miles_765kv_plus numeric(12, 2),
  gas_pipeline_presence_flag boolean,
  gas_pipeline_mileage_county numeric(12, 2),
  fiber_presence_flag boolean,
  water_stress_score numeric(8, 4),
  primary_market_id text,
  primary_tdu_or_utility text,
  utility_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_border_county boolean NOT NULL DEFAULT false,
  is_seam_county boolean NOT NULL DEFAULT false,
  queue_storage_mw numeric(12, 2),
  queue_solar_mw numeric(12, 2),
  queue_wind_mw numeric(12, 2),
  queue_avg_age_days numeric(12, 2),
  queue_withdrawal_rate numeric(8, 6),
  recent_online_mw numeric(12, 2),
  avg_rt_congestion_component numeric(12, 4),
  p95_shadow_price numeric(12, 4),
  negative_price_hour_share numeric(8, 6),
  top_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula_version text NOT NULL,
  input_data_version text NOT NULL,
  model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS county_market_pressure_current_rank_idx
  ON analytics.county_market_pressure_current (rank_status, market_pressure_index DESC);

COMMENT ON COLUMN analytics.county_market_pressure_current.water_stress_score
  IS 'Deprecated storage-only field retained for backward-compatible live tables; the county score API no longer publishes water stress.';

ALTER TABLE IF EXISTS analytics.county_market_pressure_current
  ADD COLUMN IF NOT EXISTS evidence_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS method_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS coverage_confidence text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS freshness_state text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS suppression_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS wholesale_operator text,
  ADD COLUMN IF NOT EXISTS market_structure text,
  ADD COLUMN IF NOT EXISTS balancing_authority text,
  ADD COLUMN IF NOT EXISTS load_zone text,
  ADD COLUMN IF NOT EXISTS weather_zone text,
  ADD COLUMN IF NOT EXISTS operator_zone_label text,
  ADD COLUMN IF NOT EXISTS operator_zone_type text,
  ADD COLUMN IF NOT EXISTS operator_zone_confidence text,
  ADD COLUMN IF NOT EXISTS operator_weather_zone text,
  ADD COLUMN IF NOT EXISTS meteo_zone text,
  ADD COLUMN IF NOT EXISTS retail_choice_status text,
  ADD COLUMN IF NOT EXISTS competitive_area_type text,
  ADD COLUMN IF NOT EXISTS transmission_miles_69kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_138kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_230kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_345kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_500kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS transmission_miles_765kv_plus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS primary_tdu_or_utility text,
  ADD COLUMN IF NOT EXISTS utility_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_border_county boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_storage_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_solar_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_wind_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_avg_age_days numeric(12, 2),
  ADD COLUMN IF NOT EXISTS queue_withdrawal_rate numeric(8, 6),
  ADD COLUMN IF NOT EXISTS recent_online_mw numeric(12, 2),
  ADD COLUMN IF NOT EXISTS avg_rt_congestion_component numeric(12, 4),
  ADD COLUMN IF NOT EXISTS p95_shadow_price numeric(12, 4),
  ADD COLUMN IF NOT EXISTS negative_price_hour_share numeric(8, 6),
  ADD COLUMN IF NOT EXISTS top_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS analytics.fact_county_catchment_snapshot (
  publication_run_id text NOT NULL,
  county_geoid text NOT NULL,
  registry_version text,
  adjacency_source_id text NOT NULL DEFAULT 'census-county-adjacency-2025',
  adjacency_source_version_id text,
  neighbor_count integer NOT NULL DEFAULT 0,
  shared_edge_neighbor_count integer NOT NULL DEFAULT 0,
  point_touch_neighbor_count integer NOT NULL DEFAULT 0,
  total_weight_mass numeric(12, 6),
  point_touch_weight_share numeric(8, 6),
  pooled_market_pressure_index numeric(8, 4),
  pooled_demand_pressure_score numeric(8, 4),
  pooled_supply_timeline_score numeric(8, 4),
  pooled_policy_constraint_score numeric(8, 4),
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_run_id, county_geoid),
  CHECK (neighbor_count >= 0),
  CHECK (shared_edge_neighbor_count >= 0),
  CHECK (point_touch_neighbor_count >= 0),
  CHECK (
    point_touch_weight_share IS NULL
    OR (point_touch_weight_share >= 0 AND point_touch_weight_share <= 1)
  ),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS fact_county_catchment_snapshot_publication_idx
  ON analytics.fact_county_catchment_snapshot (publication_run_id, county_geoid);

CREATE TABLE IF NOT EXISTS analytics.county_catchment_current (
  county_geoid text PRIMARY KEY,
  publication_run_id text NOT NULL,
  registry_version text,
  adjacency_source_id text NOT NULL DEFAULT 'census-county-adjacency-2025',
  adjacency_source_version_id text,
  neighbor_count integer NOT NULL DEFAULT 0,
  shared_edge_neighbor_count integer NOT NULL DEFAULT 0,
  point_touch_neighbor_count integer NOT NULL DEFAULT 0,
  total_weight_mass numeric(12, 6),
  point_touch_weight_share numeric(8, 6),
  pooled_market_pressure_index numeric(8, 4),
  pooled_demand_pressure_score numeric(8, 4),
  pooled_supply_timeline_score numeric(8, 4),
  pooled_policy_constraint_score numeric(8, 4),
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (neighbor_count >= 0),
  CHECK (shared_edge_neighbor_count >= 0),
  CHECK (point_touch_neighbor_count >= 0),
  CHECK (
    point_touch_weight_share IS NULL
    OR (point_touch_weight_share >= 0 AND point_touch_weight_share <= 1)
  ),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE TABLE IF NOT EXISTS analytics.fact_corridor_snapshot (
  publication_run_id text NOT NULL,
  corridor_object_id text NOT NULL,
  entity_type text NOT NULL,
  market_id text NOT NULL,
  market_name text,
  registry_version text,
  market_treatment text NOT NULL,
  truth_mode text NOT NULL DEFAULT 'derived_screening',
  validation_state text NOT NULL DEFAULT 'not_run',
  route_diversity_score numeric(8, 4),
  nearby_substation_count integer,
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  evidence_families text[] NOT NULL DEFAULT '{}'::text[],
  geom geometry(Geometry, 4326),
  geom_3857 geometry(Geometry, 3857),
  centroid geometry(Point, 4326),
  centroid_3857 geometry(Point, 3857),
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_run_id, corridor_object_id),
  CHECK (entity_type IN ('corridor', 'hub')),
  CHECK (market_treatment IN ('validated_market', 'derived_market')),
  CHECK (truth_mode IN (
    'full',
    'validated_screening',
    'derived_screening',
    'context_only',
    'internal_only'
  )),
  CHECK (validation_state IN ('pass', 'fail', 'not_run')),
  CHECK (nearby_substation_count IS NULL OR nearby_substation_count >= 0),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS fact_corridor_snapshot_market_idx
  ON analytics.fact_corridor_snapshot (publication_run_id, market_id, entity_type);

CREATE TABLE IF NOT EXISTS analytics.corridor_current (
  corridor_object_id text PRIMARY KEY,
  publication_run_id text NOT NULL,
  entity_type text NOT NULL,
  market_id text NOT NULL,
  market_name text,
  registry_version text,
  market_treatment text NOT NULL,
  truth_mode text NOT NULL DEFAULT 'derived_screening',
  validation_state text NOT NULL DEFAULT 'not_run',
  route_diversity_score numeric(8, 4),
  nearby_substation_count integer,
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  evidence_families text[] NOT NULL DEFAULT '{}'::text[],
  geom geometry(Geometry, 4326),
  geom_3857 geometry(Geometry, 3857),
  centroid geometry(Point, 4326),
  centroid_3857 geometry(Point, 3857),
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (entity_type IN ('corridor', 'hub')),
  CHECK (market_treatment IN ('validated_market', 'derived_market')),
  CHECK (truth_mode IN (
    'full',
    'validated_screening',
    'derived_screening',
    'context_only',
    'internal_only'
  )),
  CHECK (validation_state IN ('pass', 'fail', 'not_run')),
  CHECK (nearby_substation_count IS NULL OR nearby_substation_count >= 0),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS corridor_current_market_idx
  ON analytics.corridor_current (market_id, entity_type, market_treatment);

CREATE TABLE IF NOT EXISTS analytics.fact_parcel_pre_diligence_snapshot (
  analysis_run_id text NOT NULL,
  parcel_id text NOT NULL,
  registry_version text,
  gate_outcome text NOT NULL,
  gating_constraint_count integer NOT NULL DEFAULT 0,
  failed_constraint_count integer NOT NULL DEFAULT 0,
  access_context_available boolean NOT NULL DEFAULT false,
  nearest_corridor_id text,
  nearest_hub_id text,
  nearest_corridor_distance_meters numeric(12, 2),
  nearest_hub_distance_meters numeric(12, 2),
  zoning_screen_state text,
  flood_screen_state text,
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_run_id, parcel_id),
  CHECK (gate_outcome IN ('pass', 'fail', 'review_required')),
  CHECK (gating_constraint_count >= 0),
  CHECK (failed_constraint_count >= 0),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS fact_parcel_pre_diligence_snapshot_run_idx
  ON analytics.fact_parcel_pre_diligence_snapshot (analysis_run_id, gate_outcome, suppression_state);

CREATE TABLE IF NOT EXISTS analytics.parcel_pre_diligence_current (
  parcel_id text PRIMARY KEY,
  analysis_run_id text NOT NULL,
  registry_version text,
  gate_outcome text NOT NULL,
  gating_constraint_count integer NOT NULL DEFAULT 0,
  failed_constraint_count integer NOT NULL DEFAULT 0,
  access_context_available boolean NOT NULL DEFAULT false,
  nearest_corridor_id text,
  nearest_hub_id text,
  nearest_corridor_distance_meters numeric(12, 2),
  nearest_hub_distance_meters numeric(12, 2),
  zoning_screen_state text,
  flood_screen_state text,
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gate_outcome IN ('pass', 'fail', 'review_required')),
  CHECK (gating_constraint_count >= 0),
  CHECK (failed_constraint_count >= 0),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE TABLE IF NOT EXISTS analytics.fact_packet_section_snapshot (
  packet_run_id text NOT NULL,
  packet_id text NOT NULL,
  section_key text NOT NULL,
  audience text NOT NULL,
  object_scope text NOT NULL,
  object_id text NOT NULL,
  registry_version text,
  effective_truth_mode text NOT NULL DEFAULT 'internal_only',
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  summary text,
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (packet_run_id, packet_id, section_key, audience),
  CHECK (audience IN ('internal', 'external')),
  CHECK (effective_truth_mode IN (
    'full',
    'validated_screening',
    'derived_screening',
    'context_only',
    'internal_only'
  )),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS fact_packet_section_snapshot_packet_idx
  ON analytics.fact_packet_section_snapshot (packet_id, audience, section_key);

CREATE TABLE IF NOT EXISTS analytics.fact_policy_posture_snapshot (
  publication_run_id text NOT NULL,
  posture_id text NOT NULL,
  geography_scope text NOT NULL,
  geography_key text NOT NULL,
  registry_version text,
  effective_date date NOT NULL,
  effective_truth_mode text NOT NULL DEFAULT 'derived_screening',
  event_count integer NOT NULL DEFAULT 0,
  jurisdiction_coverage_share numeric(8, 6),
  summary text,
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_run_id, posture_id),
  CHECK (geography_scope IN ('national', 'market', 'state', 'county', 'corridor', 'parcel')),
  CHECK (effective_truth_mode IN (
    'full',
    'validated_screening',
    'derived_screening',
    'context_only',
    'internal_only'
  )),
  CHECK (event_count >= 0),
  CHECK (
    jurisdiction_coverage_share IS NULL
    OR (jurisdiction_coverage_share >= 0 AND jurisdiction_coverage_share <= 1)
  ),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS fact_policy_posture_snapshot_geography_idx
  ON analytics.fact_policy_posture_snapshot (geography_scope, geography_key, effective_date DESC);

CREATE TABLE IF NOT EXISTS analytics.policy_posture_current (
  posture_id text PRIMARY KEY,
  publication_run_id text NOT NULL,
  geography_scope text NOT NULL,
  geography_key text NOT NULL,
  registry_version text,
  effective_date date NOT NULL,
  effective_truth_mode text NOT NULL DEFAULT 'derived_screening',
  event_count integer NOT NULL DEFAULT 0,
  jurisdiction_coverage_share numeric(8, 6),
  summary text,
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  evidence_confidence text NOT NULL DEFAULT 'unknown',
  method_confidence text NOT NULL DEFAULT 'unknown',
  coverage_confidence text NOT NULL DEFAULT 'unknown',
  freshness_state text NOT NULL DEFAULT 'unknown',
  suppression_state text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (geography_scope IN ('national', 'market', 'state', 'county', 'corridor', 'parcel')),
  CHECK (effective_truth_mode IN (
    'full',
    'validated_screening',
    'derived_screening',
    'context_only',
    'internal_only'
  )),
  CHECK (event_count >= 0),
  CHECK (
    jurisdiction_coverage_share IS NULL
    OR (jurisdiction_coverage_share >= 0 AND jurisdiction_coverage_share <= 1)
  ),
  CHECK (evidence_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (method_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (coverage_confidence IN ('high', 'medium', 'low', 'unknown')),
  CHECK (freshness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (suppression_state IN ('none', 'downgraded', 'review_required', 'suppressed'))
);

DROP VIEW IF EXISTS serve.county_market_pressure_current_lod1;

CREATE VIEW serve.county_market_pressure_current_lod1 AS
SELECT
  county.county_geoid AS county_fips,
  county.county_name,
  county.state_abbrev,
  county.geom,
  county.geom_3857,
  pressure.publication_run_id,
  pressure.rank_status,
  pressure.attractiveness_tier,
  pressure.evidence_confidence,
  pressure.method_confidence,
  pressure.coverage_confidence,
  pressure.freshness_state,
  pressure.suppression_state,
  pressure.confidence_badge,
  pressure.market_pressure_index,
  pressure.demand_pressure_score,
  pressure.supply_timeline_score,
  pressure.grid_friction_score,
  pressure.policy_constraint_score,
  pressure.freshness_score,
  pressure.source_volatility,
  pressure.last_updated_at,
  pressure.narrative_summary,
  pressure.top_drivers_json,
  pressure.deferred_reason_codes_json,
  pressure.what_changed_30d_json,
  pressure.what_changed_60d_json,
  pressure.what_changed_90d_json,
  pressure.pillar_value_states_json,
  pressure.expected_mw_0_24m,
  pressure.expected_mw_24_60m,
  pressure.recent_commissioned_mw_24m,
  pressure.demand_momentum_qoq,
  pressure.provider_entry_count_12m,
  pressure.expected_supply_mw_0_36m,
  pressure.expected_supply_mw_36_60m,
  pressure.signed_ia_mw,
  pressure.queue_mw_active,
  pressure.queue_project_count_active,
  pressure.median_days_in_queue_active,
  pressure.past_due_share,
  pressure.market_withdrawal_prior,
  pressure.congestion_proxy_score,
  pressure.planned_upgrade_count,
  pressure.heatmap_signal_flag,
  pressure.policy_momentum_score,
  pressure.moratorium_status,
  pressure.public_sentiment_score,
  pressure.policy_event_count,
  pressure.county_tagged_event_share,
  pressure.policy_mapping_confidence,
  pressure.wholesale_operator,
  pressure.market_structure,
  pressure.balancing_authority,
  pressure.load_zone,
  pressure.weather_zone,
  pressure.operator_zone_label,
  pressure.operator_zone_type,
  pressure.operator_zone_confidence,
  pressure.operator_weather_zone,
  pressure.meteo_zone,
  pressure.retail_choice_status,
  pressure.competitive_area_type,
  pressure.transmission_miles_69kv_plus,
  pressure.transmission_miles_138kv_plus,
  pressure.transmission_miles_230kv_plus,
  pressure.transmission_miles_345kv_plus,
  pressure.transmission_miles_500kv_plus,
  pressure.transmission_miles_765kv_plus,
  pressure.gas_pipeline_presence_flag,
  pressure.gas_pipeline_mileage_county,
  pressure.fiber_presence_flag,
  pressure.primary_market_id,
  pressure.primary_tdu_or_utility,
  pressure.utility_context_json,
  pressure.is_border_county,
  pressure.is_seam_county,
  pressure.queue_storage_mw,
  pressure.queue_solar_mw,
  pressure.queue_wind_mw,
  pressure.queue_avg_age_days,
  pressure.queue_withdrawal_rate,
  pressure.recent_online_mw,
  pressure.avg_rt_congestion_component,
  pressure.p95_shadow_price,
  pressure.negative_price_hour_share,
  pressure.top_constraints_json,
  pressure.source_provenance_json,
  pressure.formula_version,
  pressure.input_data_version,
  pressure.model_version
FROM analytics.dim_county AS county
LEFT JOIN analytics.county_market_pressure_current AS pressure
  ON pressure.county_geoid = county.county_geoid;

COMMENT ON VIEW serve.county_market_pressure_current_lod1
  IS 'County polygon-layer read model for county-first market-pressure rendering and click-detail queries.';

DROP VIEW IF EXISTS serve.county_power_rollup_current;

CREATE VIEW serve.county_power_rollup_current AS
SELECT
  county.county_geoid AS county_fips,
  county.county_name,
  county.state_abbrev,
  county.geom,
  county.geom_3857,
  pressure.publication_run_id,
  pressure.evidence_confidence,
  pressure.method_confidence,
  pressure.coverage_confidence,
  pressure.freshness_state,
  pressure.suppression_state,
  pressure.wholesale_operator,
  pressure.market_structure,
  pressure.balancing_authority,
  pressure.load_zone,
  pressure.weather_zone,
  pressure.operator_zone_label,
  pressure.operator_zone_type,
  pressure.operator_zone_confidence,
  pressure.operator_weather_zone,
  pressure.meteo_zone,
  pressure.retail_choice_status,
  pressure.competitive_area_type,
  pressure.primary_tdu_or_utility,
  pressure.utility_context_json,
  pressure.is_border_county,
  pressure.transmission_miles_69kv_plus,
  pressure.transmission_miles_138kv_plus,
  pressure.transmission_miles_230kv_plus,
  pressure.transmission_miles_345kv_plus,
  pressure.transmission_miles_500kv_plus,
  pressure.transmission_miles_765kv_plus,
  pressure.gas_pipeline_presence_flag,
  pressure.gas_pipeline_mileage_county,
  pressure.fiber_presence_flag,
  pressure.queue_mw_active,
  pressure.queue_project_count_active,
  pressure.queue_storage_mw,
  pressure.queue_solar_mw,
  pressure.queue_wind_mw,
  pressure.queue_avg_age_days,
  pressure.queue_withdrawal_rate,
  pressure.recent_online_mw,
  pressure.avg_rt_congestion_component,
  pressure.p95_shadow_price,
  pressure.negative_price_hour_share,
  pressure.top_constraints_json,
  pressure.source_provenance_json,
  pressure.formula_version,
  pressure.input_data_version,
  pressure.model_version
FROM analytics.dim_county AS county
LEFT JOIN analytics.county_market_pressure_current AS pressure
  ON pressure.county_geoid = county.county_geoid;

COMMENT ON VIEW serve.county_power_rollup_current
  IS 'County polygon-layer power context read model with wholesale, retail, transmission, queue, congestion, and provenance attributes.';

DROP VIEW IF EXISTS serve.county_interconnection_queue_current_lod1;

CREATE VIEW serve.county_interconnection_queue_current_lod1 AS
SELECT
  county.county_geoid AS county_fips,
  county.county_name,
  county.state_abbrev,
  county.geom,
  county.geom_3857,
  pressure.publication_run_id,
  pressure.rank_status,
  pressure.evidence_confidence,
  pressure.method_confidence,
  pressure.coverage_confidence,
  pressure.freshness_state,
  pressure.suppression_state,
  pressure.wholesale_operator,
  pressure.market_structure,
  pressure.is_border_county,
  pressure.queue_mw_active,
  pressure.queue_project_count_active,
  pressure.queue_storage_mw,
  pressure.queue_solar_mw,
  pressure.queue_wind_mw,
  pressure.queue_avg_age_days,
  pressure.queue_withdrawal_rate,
  pressure.recent_online_mw,
  pressure.source_provenance_json,
  pressure.formula_version,
  pressure.input_data_version,
  pressure.model_version
FROM analytics.dim_county AS county
LEFT JOIN analytics.county_market_pressure_current AS pressure
  ON pressure.county_geoid = county.county_geoid;

COMMENT ON VIEW serve.county_interconnection_queue_current_lod1
  IS 'County polygon-layer read model for current interconnection-queue rollups, tech mix, and queue provenance.';

DROP VIEW IF EXISTS serve.corridor_current;

CREATE VIEW serve.corridor_current AS
SELECT
  current_corridor.corridor_object_id,
  current_corridor.publication_run_id,
  current_corridor.entity_type,
  current_corridor.market_id,
  current_corridor.market_name,
  current_corridor.registry_version,
  current_corridor.market_treatment,
  current_corridor.truth_mode,
  current_corridor.validation_state,
  current_corridor.route_diversity_score,
  current_corridor.nearby_substation_count,
  current_corridor.source_ids,
  current_corridor.evidence_families,
  current_corridor.geom,
  current_corridor.geom_3857,
  current_corridor.centroid,
  current_corridor.centroid_3857,
  current_corridor.evidence_confidence,
  current_corridor.method_confidence,
  current_corridor.coverage_confidence,
  current_corridor.freshness_state,
  current_corridor.suppression_state,
  current_corridor.updated_at
FROM analytics.corridor_current AS current_corridor;

COMMENT ON VIEW serve.corridor_current
  IS 'Current corridor and hub surface objects with the shared confidence vector and truth-mode fields.';

DO $$
BEGIN
  IF to_regclass('registry.source_definition') IS NULL
    OR to_regclass('registry.source_version') IS NULL
    OR to_regclass('registry.source_runtime_status') IS NULL
    OR to_regclass('registry.source_dependency_rule') IS NULL THEN
    RAISE EXCEPTION
      'Source registry schema is required before county confidence views can be created. Run scripts/init-source-registry-schema.sh and publish the registry first.';
  END IF;
END;
$$;

DROP VIEW IF EXISTS analytics.v_downstream_confidence_trace_current;
DROP VIEW IF EXISTS analytics.v_downstream_confidence_caps_current;
DROP VIEW IF EXISTS analytics.v_source_dependency_effects_current;
DROP VIEW IF EXISTS analytics.v_source_dependency_runtime_current;

CREATE VIEW analytics.v_source_dependency_runtime_current AS
SELECT
  downstream_rules.registry_version,
  downstream_rules.dependency_rule_id,
  downstream_rules.source_id,
  active_sources.source_name,
  active_sources.source_family,
  active_sources.source_type,
  active_sources.integration_state,
  active_sources.default_role,
  active_sources.precision_tier,
  active_sources.launch_criticality,
  active_sources.evidence_type,
  downstream_rules.downstream_object_type,
  downstream_rules.downstream_object_id,
  downstream_rules.role_in_downstream,
  downstream_rules.requiredness,
  downstream_rules.warn_if_days_stale,
  downstream_rules.degrade_if_days_stale,
  downstream_rules.suppress_if_days_stale,
  downstream_rules.suppress_if_missing,
  downstream_rules.precision_tier_c_allowed_for_primary,
  downstream_rules.allowed_roles,
  downstream_rules.truth_mode_cap,
  downstream_rules.confidence_cap,
  downstream_rules.surface_scopes,
  downstream_rules.geography_scope,
  current_status.source_version_id,
  current_status.staleness_state,
  current_status.ingestion_health,
  current_status.access_status,
  current_status.runtime_alert_state,
  current_status.last_successful_ingest_at,
  current_status.last_attempted_ingest_at,
  current_status.latest_provider_update_seen_at,
  current_status.freshness_as_of,
  current_status.record_count,
  current_status.completeness_observed,
  current_status.geographic_coverage_observed,
  current_status.license_expiration_date,
  current_status.updated_at
FROM registry.downstream_rules AS downstream_rules
JOIN registry.active_sources AS active_sources
  ON active_sources.source_id = downstream_rules.source_id
  AND active_sources.registry_version = downstream_rules.registry_version
LEFT JOIN registry.current_source_status AS current_status
  ON current_status.source_id = downstream_rules.source_id
  AND current_status.registry_version = downstream_rules.registry_version;

COMMENT ON VIEW analytics.v_source_dependency_runtime_current
  IS 'Current runtime source dependency state joined from the frozen registry views for downstream confidence evaluation.';

CREATE VIEW analytics.v_source_dependency_effects_current AS
WITH dependency_age AS (
  SELECT
    runtime_current.*,
    CASE
      WHEN runtime_current.freshness_as_of IS NOT NULL
        THEN GREATEST(0, CURRENT_DATE - runtime_current.freshness_as_of::date)
      WHEN runtime_current.latest_provider_update_seen_at IS NOT NULL
        THEN GREATEST(0, CURRENT_DATE - runtime_current.latest_provider_update_seen_at::date)
      WHEN runtime_current.last_successful_ingest_at IS NOT NULL
        THEN GREATEST(0, CURRENT_DATE - runtime_current.last_successful_ingest_at::date)
      ELSE NULL::integer
    END AS source_age_days,
    CASE
      WHEN runtime_current.suppress_if_missing
        AND (
          runtime_current.access_status IS NULL
          OR runtime_current.access_status IN ('planned', 'pending_renewal', 'lost_access')
        )
        THEN TRUE
      ELSE FALSE
    END AS missing_triggered,
    (runtime_current.role_in_downstream <> 'contextual') AS is_constitutive
  FROM analytics.v_source_dependency_runtime_current AS runtime_current
),
dependency_thresholds AS (
  SELECT
    dependency_age.*,
    CASE
      WHEN dependency_age.warn_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.warn_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS warn_triggered,
    CASE
      WHEN dependency_age.degrade_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.degrade_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS degrade_triggered,
    CASE
      WHEN dependency_age.suppress_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.suppress_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS suppress_triggered
  FROM dependency_age
)
SELECT
  dependency_thresholds.registry_version,
  dependency_thresholds.dependency_rule_id,
  dependency_thresholds.source_id,
  dependency_thresholds.source_name,
  dependency_thresholds.source_family,
  dependency_thresholds.source_type,
  dependency_thresholds.integration_state,
  dependency_thresholds.default_role,
  dependency_thresholds.precision_tier,
  dependency_thresholds.launch_criticality,
  dependency_thresholds.evidence_type,
  dependency_thresholds.downstream_object_type,
  dependency_thresholds.downstream_object_id,
  dependency_thresholds.role_in_downstream,
  dependency_thresholds.requiredness,
  dependency_thresholds.warn_if_days_stale,
  dependency_thresholds.degrade_if_days_stale,
  dependency_thresholds.suppress_if_days_stale,
  dependency_thresholds.suppress_if_missing,
  dependency_thresholds.precision_tier_c_allowed_for_primary,
  dependency_thresholds.allowed_roles,
  dependency_thresholds.truth_mode_cap,
  dependency_thresholds.confidence_cap,
  dependency_thresholds.surface_scopes,
  dependency_thresholds.geography_scope,
  dependency_thresholds.source_version_id,
  dependency_thresholds.staleness_state,
  dependency_thresholds.ingestion_health,
  dependency_thresholds.access_status,
  dependency_thresholds.runtime_alert_state,
  dependency_thresholds.last_successful_ingest_at,
  dependency_thresholds.last_attempted_ingest_at,
  dependency_thresholds.latest_provider_update_seen_at,
  dependency_thresholds.freshness_as_of,
  dependency_thresholds.record_count,
  dependency_thresholds.completeness_observed,
  dependency_thresholds.geographic_coverage_observed,
  dependency_thresholds.license_expiration_date,
  dependency_thresholds.updated_at,
  dependency_thresholds.source_age_days,
  dependency_thresholds.is_constitutive,
  dependency_thresholds.warn_triggered,
  dependency_thresholds.degrade_triggered,
  dependency_thresholds.suppress_triggered,
  dependency_thresholds.missing_triggered,
  CASE
    WHEN dependency_thresholds.missing_triggered THEN 'critical'
    WHEN dependency_thresholds.suppress_triggered
      OR dependency_thresholds.staleness_state = 'critical'
      THEN 'critical'
    WHEN dependency_thresholds.degrade_triggered
      OR dependency_thresholds.staleness_state = 'stale'
      THEN 'stale'
    WHEN dependency_thresholds.warn_triggered
      OR dependency_thresholds.staleness_state = 'aging'
      THEN 'aging'
    WHEN dependency_thresholds.staleness_state = 'fresh' THEN 'fresh'
    ELSE 'unknown'
  END AS effective_freshness_state
FROM dependency_thresholds;

COMMENT ON VIEW analytics.v_source_dependency_effects_current
  IS 'Derived dependency effects from the current registry state, including threshold triggers, missingness, and effective freshness.';

CREATE VIEW analytics.v_downstream_confidence_caps_current AS
WITH constitutive_dependencies AS (
  SELECT *
  FROM analytics.v_source_dependency_effects_current
  WHERE is_constitutive
),
aggregated AS (
  SELECT
    constitutive_dependencies.registry_version,
    constitutive_dependencies.downstream_object_type,
    constitutive_dependencies.downstream_object_id,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
    )::integer AS required_source_count,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
        AND (
          constitutive_dependencies.access_status IS NULL
          OR constitutive_dependencies.access_status <> 'accessible'
        )
    )::integer AS unavailable_required_source_count,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
        AND constitutive_dependencies.suppress_if_missing
        AND (
          constitutive_dependencies.access_status IS NULL
          OR constitutive_dependencies.access_status IN (
            'planned',
            'pending_renewal',
            'lost_access'
          )
        )
    )::integer AS suppressible_missing_required_count,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
        AND constitutive_dependencies.effective_freshness_state = 'critical'
    )::integer AS critical_required_source_count,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
        AND constitutive_dependencies.effective_freshness_state = 'stale'
    )::integer AS stale_required_source_count,
    COUNT(*) FILTER (
      WHERE constitutive_dependencies.requiredness = 'required'
        AND constitutive_dependencies.effective_freshness_state = 'aging'
    )::integer AS aging_required_source_count,
    MIN(
      CASE constitutive_dependencies.confidence_cap
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END
    ) AS confidence_cap_rank,
    MIN(
      CASE constitutive_dependencies.truth_mode_cap
        WHEN 'full' THEN 5
        WHEN 'validated_screening' THEN 4
        WHEN 'derived_screening' THEN 3
        WHEN 'context_only' THEN 2
        WHEN 'internal_only' THEN 1
        ELSE 0
      END
    ) AS truth_mode_cap_rank,
    MIN(
      CASE constitutive_dependencies.effective_freshness_state
        WHEN 'critical' THEN 1
        WHEN 'stale' THEN 2
        WHEN 'aging' THEN 3
        WHEN 'fresh' THEN 4
        ELSE 0
      END
    ) AS freshness_rank
  FROM constitutive_dependencies
  GROUP BY
    constitutive_dependencies.registry_version,
    constitutive_dependencies.downstream_object_type,
    constitutive_dependencies.downstream_object_id
)
SELECT
  aggregated.registry_version,
  aggregated.downstream_object_type,
  aggregated.downstream_object_id,
  CASE aggregated.confidence_cap_rank
    WHEN 3 THEN 'high'
    WHEN 2 THEN 'medium'
    WHEN 1 THEN 'low'
    ELSE 'unknown'
  END AS minimum_constitutive_confidence_cap,
  CASE aggregated.truth_mode_cap_rank
    WHEN 5 THEN 'full'
    WHEN 4 THEN 'validated_screening'
    WHEN 3 THEN 'derived_screening'
    WHEN 2 THEN 'context_only'
    WHEN 1 THEN 'internal_only'
    ELSE 'internal_only'
  END AS minimum_truth_mode_cap,
  CASE aggregated.freshness_rank
    WHEN 4 THEN 'fresh'
    WHEN 3 THEN 'aging'
    WHEN 2 THEN 'stale'
    WHEN 1 THEN 'critical'
    ELSE 'unknown'
  END AS worst_required_freshness_state,
  aggregated.required_source_count,
  aggregated.unavailable_required_source_count,
  aggregated.suppressible_missing_required_count,
  aggregated.critical_required_source_count,
  aggregated.stale_required_source_count,
  aggregated.aging_required_source_count
FROM aggregated;

COMMENT ON VIEW analytics.v_downstream_confidence_caps_current
  IS 'Aggregated confidence and freshness caps for constitutive downstream dependencies from the current registry version.';

CREATE VIEW analytics.v_downstream_confidence_trace_current AS
WITH aggregated AS (
  SELECT *
  FROM analytics.v_downstream_confidence_caps_current
),
dependency_json AS (
  SELECT
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id,
    jsonb_agg(
      jsonb_build_object(
        'sourceId', dependency_effects.source_id,
        'sourceName', dependency_effects.source_name,
        'downstreamObjectType', dependency_effects.downstream_object_type,
        'downstreamObjectId', dependency_effects.downstream_object_id,
        'roleInDownstream', dependency_effects.role_in_downstream,
        'requiredness', dependency_effects.requiredness,
        'precisionTier', dependency_effects.precision_tier,
        'accessStatus', dependency_effects.access_status,
        'stalenessState', dependency_effects.staleness_state,
        'effectiveFreshnessState', dependency_effects.effective_freshness_state,
        'truthModeCap', dependency_effects.truth_mode_cap,
        'confidenceCap', dependency_effects.confidence_cap,
        'completenessObserved', dependency_effects.completeness_observed,
        'sourceAgeDays', dependency_effects.source_age_days,
        'warnTriggered', dependency_effects.warn_triggered,
        'degradeTriggered', dependency_effects.degrade_triggered,
        'suppressTriggered', dependency_effects.suppress_triggered,
        'missingTriggered', dependency_effects.missing_triggered
      )
      ORDER BY dependency_effects.source_id
    ) AS dependencies_json
  FROM analytics.v_source_dependency_effects_current AS dependency_effects
  GROUP BY
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id
)
SELECT
  aggregated.registry_version,
  aggregated.downstream_object_type,
  aggregated.downstream_object_id,
  aggregated.minimum_constitutive_confidence_cap,
  aggregated.minimum_truth_mode_cap,
  aggregated.worst_required_freshness_state,
  aggregated.required_source_count,
  aggregated.unavailable_required_source_count,
  aggregated.suppressible_missing_required_count,
  aggregated.critical_required_source_count,
  aggregated.stale_required_source_count,
  aggregated.aging_required_source_count,
  CASE
    WHEN aggregated.suppressible_missing_required_count > 0
      OR aggregated.unavailable_required_source_count > 0
      OR aggregated.critical_required_source_count > 0
      THEN 'review_required'
    WHEN aggregated.stale_required_source_count > 0
      OR aggregated.aging_required_source_count > 0
      THEN 'downgraded'
    ELSE 'none'
  END AS baseline_suppression_state,
  COALESCE(dependency_json.dependencies_json, '[]'::jsonb) AS dependencies_json
FROM aggregated
LEFT JOIN dependency_json
  ON dependency_json.registry_version = aggregated.registry_version
  AND dependency_json.downstream_object_type = aggregated.downstream_object_type
  AND dependency_json.downstream_object_id = aggregated.downstream_object_id;

COMMENT ON VIEW analytics.v_downstream_confidence_trace_current
  IS 'Debug-oriented downstream confidence trace, including aggregated caps and dependency-level threshold effects.';

DROP FUNCTION IF EXISTS analytics.resolve_downstream_confidence_trace(text, date);

CREATE OR REPLACE FUNCTION analytics.resolve_downstream_confidence_trace(
  p_registry_version text,
  p_reference_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  registry_version text,
  downstream_object_type text,
  downstream_object_id text,
  minimum_constitutive_confidence_cap text,
  minimum_truth_mode_cap text,
  worst_required_freshness_state text,
  required_source_count integer,
  unavailable_required_source_count integer,
  suppressible_missing_required_count integer,
  critical_required_source_count integer,
  stale_required_source_count integer,
  aging_required_source_count integer,
  baseline_suppression_state text,
  dependencies_json jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH runtime_current AS (
  SELECT
    downstream_rules.registry_version,
    downstream_rules.dependency_rule_id,
    downstream_rules.source_id,
    active_sources.source_name,
    active_sources.source_family,
    active_sources.source_type,
    active_sources.integration_state,
    active_sources.default_role,
    active_sources.precision_tier,
    active_sources.launch_criticality,
    active_sources.evidence_type,
    downstream_rules.downstream_object_type,
    downstream_rules.downstream_object_id,
    downstream_rules.role_in_downstream,
    downstream_rules.requiredness,
    downstream_rules.warn_if_days_stale,
    downstream_rules.degrade_if_days_stale,
    downstream_rules.suppress_if_days_stale,
    downstream_rules.suppress_if_missing,
    downstream_rules.precision_tier_c_allowed_for_primary,
    downstream_rules.allowed_roles,
    downstream_rules.truth_mode_cap,
    downstream_rules.confidence_cap,
    downstream_rules.surface_scopes,
    downstream_rules.geography_scope,
    current_status.current_source_version_id AS source_version_id,
    current_status.staleness_state,
    current_status.ingestion_health,
    current_status.access_status,
    current_status.runtime_alert_state,
    current_status.last_successful_ingest_at,
    current_status.last_attempted_ingest_at,
    current_status.latest_provider_update_seen_at,
    current_status.freshness_as_of,
    current_status.record_count,
    current_status.completeness_observed,
    current_status.geographic_coverage_observed,
    current_status.license_expiration_date,
    current_status.updated_at
  FROM registry.source_dependency_rule AS downstream_rules
  JOIN registry.source_definition AS active_sources
    ON active_sources.source_id = downstream_rules.source_id
    AND active_sources.registry_version = downstream_rules.registry_version
  LEFT JOIN registry.source_runtime_status AS current_status
    ON current_status.source_id = downstream_rules.source_id
    AND current_status.current_registry_version = downstream_rules.registry_version
  WHERE downstream_rules.registry_version = p_registry_version
    AND downstream_rules.effective_to IS NULL
    AND active_sources.effective_to IS NULL
),
dependency_age AS (
  SELECT
    runtime_current.*,
    CASE
      WHEN runtime_current.freshness_as_of IS NOT NULL
        THEN GREATEST(0, p_reference_date - runtime_current.freshness_as_of::date)
      WHEN runtime_current.latest_provider_update_seen_at IS NOT NULL
        THEN GREATEST(0, p_reference_date - runtime_current.latest_provider_update_seen_at::date)
      WHEN runtime_current.last_successful_ingest_at IS NOT NULL
        THEN GREATEST(0, p_reference_date - runtime_current.last_successful_ingest_at::date)
      ELSE NULL::integer
    END AS source_age_days,
    CASE
      WHEN runtime_current.suppress_if_missing
        AND (
          runtime_current.access_status IS NULL
          OR runtime_current.access_status IN ('planned', 'pending_renewal', 'lost_access')
        )
        THEN TRUE
      ELSE FALSE
    END AS missing_triggered,
    (runtime_current.role_in_downstream <> 'contextual') AS is_constitutive
  FROM runtime_current
),
dependency_effects AS (
  SELECT
    dependency_age.registry_version,
    dependency_age.dependency_rule_id,
    dependency_age.source_id,
    dependency_age.source_name,
    dependency_age.source_family,
    dependency_age.source_type,
    dependency_age.integration_state,
    dependency_age.default_role,
    dependency_age.precision_tier,
    dependency_age.launch_criticality,
    dependency_age.evidence_type,
    dependency_age.downstream_object_type,
    dependency_age.downstream_object_id,
    dependency_age.role_in_downstream,
    dependency_age.requiredness,
    dependency_age.warn_if_days_stale,
    dependency_age.degrade_if_days_stale,
    dependency_age.suppress_if_days_stale,
    dependency_age.suppress_if_missing,
    dependency_age.precision_tier_c_allowed_for_primary,
    dependency_age.allowed_roles,
    dependency_age.truth_mode_cap,
    dependency_age.confidence_cap,
    dependency_age.surface_scopes,
    dependency_age.geography_scope,
    dependency_age.source_version_id,
    dependency_age.staleness_state,
    dependency_age.ingestion_health,
    dependency_age.access_status,
    dependency_age.runtime_alert_state,
    dependency_age.last_successful_ingest_at,
    dependency_age.last_attempted_ingest_at,
    dependency_age.latest_provider_update_seen_at,
    dependency_age.freshness_as_of,
    dependency_age.record_count,
    dependency_age.completeness_observed,
    dependency_age.geographic_coverage_observed,
    dependency_age.license_expiration_date,
    dependency_age.updated_at,
    dependency_age.source_age_days,
    dependency_age.is_constitutive,
    CASE
      WHEN dependency_age.warn_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.warn_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS warn_triggered,
    CASE
      WHEN dependency_age.degrade_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.degrade_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS degrade_triggered,
    CASE
      WHEN dependency_age.suppress_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.suppress_if_days_stale
        THEN TRUE
      ELSE FALSE
    END AS suppress_triggered,
    dependency_age.missing_triggered,
    CASE
      WHEN dependency_age.missing_triggered THEN 'critical'
      WHEN (
        dependency_age.suppress_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.suppress_if_days_stale
      )
        OR dependency_age.staleness_state = 'critical'
        THEN 'critical'
      WHEN (
        dependency_age.degrade_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.degrade_if_days_stale
      )
        OR dependency_age.staleness_state = 'stale'
        THEN 'stale'
      WHEN (
        dependency_age.warn_if_days_stale IS NOT NULL
        AND dependency_age.source_age_days IS NOT NULL
        AND dependency_age.source_age_days >= dependency_age.warn_if_days_stale
      )
        OR dependency_age.staleness_state = 'aging'
        THEN 'aging'
      WHEN dependency_age.staleness_state = 'fresh' THEN 'fresh'
      ELSE 'unknown'
    END AS effective_freshness_state
  FROM dependency_age
),
aggregated AS (
  SELECT
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
    )::integer AS required_source_count,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
        AND (
          dependency_effects.access_status IS NULL
          OR dependency_effects.access_status <> 'accessible'
        )
    )::integer AS unavailable_required_source_count,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
        AND dependency_effects.suppress_if_missing
        AND (
          dependency_effects.access_status IS NULL
          OR dependency_effects.access_status IN ('planned', 'pending_renewal', 'lost_access')
        )
    )::integer AS suppressible_missing_required_count,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
        AND dependency_effects.effective_freshness_state = 'critical'
    )::integer AS critical_required_source_count,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
        AND dependency_effects.effective_freshness_state = 'stale'
    )::integer AS stale_required_source_count,
    COUNT(*) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
        AND dependency_effects.effective_freshness_state = 'aging'
    )::integer AS aging_required_source_count,
    MIN(
      CASE dependency_effects.confidence_cap
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END
    ) FILTER (WHERE dependency_effects.is_constitutive) AS confidence_cap_rank,
    MIN(
      CASE dependency_effects.truth_mode_cap
        WHEN 'full' THEN 5
        WHEN 'validated_screening' THEN 4
        WHEN 'derived_screening' THEN 3
        WHEN 'context_only' THEN 2
        WHEN 'internal_only' THEN 1
        ELSE 0
      END
    ) FILTER (WHERE dependency_effects.is_constitutive) AS truth_mode_cap_rank,
    MIN(
      CASE dependency_effects.effective_freshness_state
        WHEN 'critical' THEN 1
        WHEN 'stale' THEN 2
        WHEN 'aging' THEN 3
        WHEN 'fresh' THEN 4
        ELSE 0
      END
    ) FILTER (
      WHERE dependency_effects.is_constitutive
        AND dependency_effects.requiredness = 'required'
    ) AS freshness_rank
  FROM dependency_effects
  GROUP BY
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id
),
dependency_json AS (
  SELECT
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id,
    jsonb_agg(
      jsonb_build_object(
        'sourceId', dependency_effects.source_id,
        'sourceName', dependency_effects.source_name,
        'downstreamObjectType', dependency_effects.downstream_object_type,
        'downstreamObjectId', dependency_effects.downstream_object_id,
        'roleInDownstream', dependency_effects.role_in_downstream,
        'requiredness', dependency_effects.requiredness,
        'precisionTier', dependency_effects.precision_tier,
        'accessStatus', dependency_effects.access_status,
        'stalenessState', dependency_effects.staleness_state,
        'effectiveFreshnessState', dependency_effects.effective_freshness_state,
        'truthModeCap', dependency_effects.truth_mode_cap,
        'confidenceCap', dependency_effects.confidence_cap,
        'completenessObserved', dependency_effects.completeness_observed,
        'sourceAgeDays', dependency_effects.source_age_days,
        'warnTriggered', dependency_effects.warn_triggered,
        'degradeTriggered', dependency_effects.degrade_triggered,
        'suppressTriggered', dependency_effects.suppress_triggered,
        'missingTriggered', dependency_effects.missing_triggered
      )
      ORDER BY dependency_effects.source_id
    ) AS dependencies_json
  FROM dependency_effects
  GROUP BY
    dependency_effects.registry_version,
    dependency_effects.downstream_object_type,
    dependency_effects.downstream_object_id
)
SELECT
  aggregated.registry_version,
  aggregated.downstream_object_type,
  aggregated.downstream_object_id,
  CASE aggregated.confidence_cap_rank
    WHEN 3 THEN 'high'
    WHEN 2 THEN 'medium'
    WHEN 1 THEN 'low'
    ELSE 'unknown'
  END AS minimum_constitutive_confidence_cap,
  CASE aggregated.truth_mode_cap_rank
    WHEN 5 THEN 'full'
    WHEN 4 THEN 'validated_screening'
    WHEN 3 THEN 'derived_screening'
    WHEN 2 THEN 'context_only'
    WHEN 1 THEN 'internal_only'
    ELSE 'internal_only'
  END AS minimum_truth_mode_cap,
  CASE aggregated.freshness_rank
    WHEN 4 THEN 'fresh'
    WHEN 3 THEN 'aging'
    WHEN 2 THEN 'stale'
    WHEN 1 THEN 'critical'
    ELSE 'unknown'
  END AS worst_required_freshness_state,
  aggregated.required_source_count,
  aggregated.unavailable_required_source_count,
  aggregated.suppressible_missing_required_count,
  aggregated.critical_required_source_count,
  aggregated.stale_required_source_count,
  aggregated.aging_required_source_count,
  CASE
    WHEN aggregated.suppressible_missing_required_count > 0
      OR aggregated.unavailable_required_source_count > 0
      OR aggregated.critical_required_source_count > 0
      THEN 'review_required'
    WHEN aggregated.stale_required_source_count > 0
      OR aggregated.aging_required_source_count > 0
      THEN 'downgraded'
    ELSE 'none'
  END AS baseline_suppression_state,
  COALESCE(dependency_json.dependencies_json, '[]'::jsonb) AS dependencies_json
FROM aggregated
LEFT JOIN dependency_json
  ON dependency_json.registry_version = aggregated.registry_version
  AND dependency_json.downstream_object_type = aggregated.downstream_object_type
  AND dependency_json.downstream_object_id = aggregated.downstream_object_id;
$$;

COMMENT ON FUNCTION analytics.resolve_downstream_confidence_trace(text, date)
  IS 'Pinned-registry downstream confidence trace for reproducible scoring and replay flows.';

COMMIT;
