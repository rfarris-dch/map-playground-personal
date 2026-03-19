CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS market_source;

CREATE TABLE IF NOT EXISTS market_source.market_groups (
  market_group_id text PRIMARY KEY,
  name text,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.world_regions (
  world_region_id text PRIMARY KEY,
  name text,
  url text,
  abbreviation text,
  sort_order integer,
  latitude double precision,
  longitude double precision,
  center geometry(Point, 4326),
  boundary geometry(Polygon, 4326),
  zoom_level integer,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.markets (
  market_id text PRIMARY KEY,
  name text NOT NULL,
  region text,
  search_region text,
  country text,
  state text,
  latitude double precision,
  longitude double precision,
  center geometry(Point, 4326),
  absorption numeric,
  vacancy numeric,
  search_page boolean NOT NULL DEFAULT false,
  front_page boolean NOT NULL DEFAULT false,
  international boolean NOT NULL DEFAULT false,
  short_description text,
  synopsis text,
  search_market_description text,
  provider_overview_description text,
  market_solutions_description text,
  site_stats_description text,
  url text,
  zoom_level integer,
  market_group_id text,
  world_region_id text,
  updated_at timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.submarkets (
  submarket_id text PRIMARY KEY,
  market_id text,
  name text,
  latitude double precision,
  longitude double precision,
  geom geometry(Point, 4326),
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.market_quarterly_data (
  quarterly_data_id text PRIMARY KEY,
  market_id text,
  year integer,
  quarter integer,
  available_power numeric,
  commissioned_power numeric,
  planned_dc_power numeric,
  uc_power numeric,
  absorption_override numeric,
  preleasing integer,
  preleasing_override numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.market_yearly_data (
  yearly_data_id text PRIMARY KEY,
  market_id text,
  year integer,
  absorption numeric,
  high_range_min numeric,
  high_range_max numeric,
  low_range_min numeric,
  low_range_max numeric,
  hyper_min numeric,
  hyper_max numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.market_totals_data (
  market_totals_data_id text PRIMARY KEY,
  market_id text,
  year integer,
  quarter integer,
  available_power numeric,
  available_sf numeric,
  commissioned_power numeric,
  commissioned_sf numeric,
  planned_power numeric,
  planned_sf numeric,
  uc_power numeric,
  uc_sf numeric,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.market_updates (
  market_id text NOT NULL,
  year integer NOT NULL,
  quarter integer NOT NULL,
  market_updates text,
  payload jsonb NOT NULL,
  PRIMARY KEY (market_id, year, quarter)
);

CREATE TABLE IF NOT EXISTS market_source.market_cap_reports (
  cap_report_id text PRIMARY KEY,
  market_id text,
  retail_available_total numeric,
  retail_commissioned_total numeric,
  retail_planned_total numeric,
  retail_under_construction_total numeric,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.companies (
  company_id text PRIMARY KEY,
  company_name text,
  archived boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.power_space_info (
  power_space_info_id text PRIMARY KEY,
  available_power numeric,
  commissioned_power numeric,
  planned_dc_power numeric,
  under_construction_power numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.facility_quarterly_data (
  facility_quarterly_data_id text PRIMARY KEY,
  facility_id text,
  year integer,
  quarter integer,
  available_power numeric,
  commissioned_power numeric,
  planned_power numeric,
  under_construction_power numeric,
  preleasing_override numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.colocation_points (
  point_id text PRIMARY KEY,
  market_id text,
  facility_location_id text,
  address_line1 text,
  city text,
  state text,
  country text,
  county_fips text,
  latitude double precision,
  longitude double precision,
  geom geometry(Point, 4326),
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.hyperscale_facility_current (
  facility_id text PRIMARY KEY,
  market_id text,
  submarket_id text,
  company text,
  commissioned_power numeric,
  estimated_commissioned_power numeric,
  under_construction_power numeric,
  planned_power numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.hyperscale_points (
  point_id text PRIMARY KEY,
  market_id text,
  submarket_id text,
  company text,
  facility_code text,
  address text,
  city text,
  state text,
  country text,
  county_fips text,
  facility_status text,
  lease_or_own text,
  latitude double precision,
  longitude double precision,
  geom geometry(Point, 4326),
  updated_at timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.hyperscale_historical_capacity (
  historical_capacity_id text PRIMARY KEY,
  facility_id text,
  year integer,
  quarter integer,
  owned_power numeric,
  under_construction_power numeric,
  planned_power numeric,
  live boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.hyperscale_company_lease_total (
  lease_total_id text PRIMARY KEY,
  company_id text,
  market_id text,
  year integer,
  total numeric,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.hs_grid_company_market_lease_total (
  lease_total_id text PRIMARY KEY,
  company_id text,
  market_id text,
  year integer,
  total numeric,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.insight_forecast (
  forecast_id text PRIMARY KEY,
  market_id text,
  year integer,
  commissioned_power numeric,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS market_source.insight_pricing_forecast (
  pricing_forecast_id text PRIMARY KEY,
  market_id text,
  year integer,
  retail_min numeric,
  retail_max numeric,
  wholesale_min numeric,
  wholesale_max numeric,
  hyper_min numeric,
  hyper_max numeric,
  absorption numeric,
  currency_id text,
  archived boolean NOT NULL DEFAULT false,
  date_updated timestamptz,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS market_groups_name_idx
  ON market_source.market_groups (name);

CREATE INDEX IF NOT EXISTS world_regions_name_idx
  ON market_source.world_regions (name);

CREATE INDEX IF NOT EXISTS world_regions_boundary_idx
  ON market_source.world_regions
  USING gist (boundary);

CREATE INDEX IF NOT EXISTS markets_search_page_idx
  ON market_source.markets (search_page, name);

CREATE INDEX IF NOT EXISTS markets_center_idx
  ON market_source.markets
  USING gist (center);

CREATE INDEX IF NOT EXISTS markets_world_region_idx
  ON market_source.markets (world_region_id);

CREATE INDEX IF NOT EXISTS markets_market_group_idx
  ON market_source.markets (market_group_id);

CREATE INDEX IF NOT EXISTS markets_updated_at_idx
  ON market_source.markets (updated_at DESC);

CREATE INDEX IF NOT EXISTS submarkets_market_id_idx
  ON market_source.submarkets (market_id);

CREATE INDEX IF NOT EXISTS submarkets_geom_idx
  ON market_source.submarkets
  USING gist (geom);

CREATE INDEX IF NOT EXISTS market_quarterly_data_market_id_idx
  ON market_source.market_quarterly_data (market_id, year DESC, quarter DESC);

CREATE INDEX IF NOT EXISTS market_yearly_data_market_id_idx
  ON market_source.market_yearly_data (market_id, year DESC);

CREATE INDEX IF NOT EXISTS market_totals_data_market_id_idx
  ON market_source.market_totals_data (market_id, year DESC, quarter DESC);

CREATE INDEX IF NOT EXISTS market_updates_market_id_idx
  ON market_source.market_updates (market_id, year DESC, quarter DESC);

CREATE INDEX IF NOT EXISTS market_cap_reports_market_id_idx
  ON market_source.market_cap_reports (market_id);

CREATE INDEX IF NOT EXISTS companies_company_name_idx
  ON market_source.companies (company_name);

CREATE INDEX IF NOT EXISTS power_space_info_date_updated_idx
  ON market_source.power_space_info (date_updated DESC);

CREATE INDEX IF NOT EXISTS facility_quarterly_data_facility_id_idx
  ON market_source.facility_quarterly_data (facility_id, year DESC, quarter DESC);

CREATE INDEX IF NOT EXISTS colocation_points_market_id_idx
  ON market_source.colocation_points (market_id);

CREATE INDEX IF NOT EXISTS colocation_points_geom_idx
  ON market_source.colocation_points
  USING gist (geom);

CREATE INDEX IF NOT EXISTS hyperscale_facility_current_market_id_idx
  ON market_source.hyperscale_facility_current (market_id);

CREATE INDEX IF NOT EXISTS hyperscale_facility_current_submarket_id_idx
  ON market_source.hyperscale_facility_current (submarket_id);

CREATE INDEX IF NOT EXISTS hyperscale_points_market_id_idx
  ON market_source.hyperscale_points (market_id);

CREATE INDEX IF NOT EXISTS hyperscale_points_geom_idx
  ON market_source.hyperscale_points
  USING gist (geom);

CREATE INDEX IF NOT EXISTS hyperscale_historical_capacity_facility_id_idx
  ON market_source.hyperscale_historical_capacity (facility_id, year DESC, quarter DESC);

CREATE INDEX IF NOT EXISTS hyperscale_company_lease_total_lookup_idx
  ON market_source.hyperscale_company_lease_total (company_id, market_id, year DESC);

CREATE INDEX IF NOT EXISTS hs_grid_company_market_lease_total_lookup_idx
  ON market_source.hs_grid_company_market_lease_total (company_id, market_id, year DESC);

CREATE INDEX IF NOT EXISTS insight_forecast_market_id_idx
  ON market_source.insight_forecast (market_id, year DESC);

CREATE INDEX IF NOT EXISTS insight_pricing_forecast_market_id_idx
  ON market_source.insight_pricing_forecast (market_id, year DESC);
