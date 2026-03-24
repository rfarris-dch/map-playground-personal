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

COMMIT;
