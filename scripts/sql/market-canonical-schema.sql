BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS canon;
CREATE SCHEMA IF NOT EXISTS serve;

CREATE OR REPLACE FUNCTION canon.stable_uuid(namespace_key text, source_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT uuid_generate_v5(
    '00000000-0000-0000-0000-000000000001'::uuid,
    namespace_key || ':' || source_key
  );
$$;

CREATE TABLE IF NOT EXISTS canon.load_batch (
  load_batch_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_kind text NOT NULL,
  source_basis text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS canon.provenance_row (
  provenance_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  load_batch_id bigint NOT NULL REFERENCES canon.load_batch(load_batch_id) ON DELETE CASCADE,
  extracted_at timestamptz NOT NULL,
  row_hash text NOT NULL
);

CREATE INDEX IF NOT EXISTS provenance_row_lookup_idx
  ON canon.provenance_row (source_system, source_table, source_pk, load_batch_id);

CREATE TABLE IF NOT EXISTS canon.dim_period (
  period_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  granularity text NOT NULL CHECK (granularity IN ('quarter', 'year')),
  year_num smallint NOT NULL,
  quarter_num smallint,
  label text NOT NULL UNIQUE,
  CHECK (
    (granularity = 'quarter' AND quarter_num BETWEEN 1 AND 4) OR
    (granularity = 'year' AND quarter_num IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS dim_period_grain_idx
  ON canon.dim_period (granularity, year_num, COALESCE(quarter_num, 0));

CREATE TABLE IF NOT EXISTS canon.dim_company (
  company_id uuid PRIMARY KEY,
  canonical_name text NOT NULL UNIQUE,
  company_kind text NOT NULL CHECK (company_kind IN ('colo_provider', 'hyperscaler', 'cloud', 'other')),
  is_active boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id)
);

CREATE TABLE IF NOT EXISTS canon.dim_market (
  market_id uuid PRIMARY KEY,
  canonical_name text NOT NULL,
  region_name text,
  is_active boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id)
);

ALTER TABLE canon.dim_market
  DROP CONSTRAINT IF EXISTS dim_market_canonical_name_key;

CREATE TABLE IF NOT EXISTS canon.dim_submarket (
  submarket_id uuid PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  canonical_name text NOT NULL,
  is_active boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  UNIQUE (market_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS canon.dim_facility (
  facility_id uuid PRIMARY KEY,
  facility_kind text NOT NULL CHECK (facility_kind IN ('colo', 'hyperscale', 'cloud', 'shell', 'site')),
  canonical_name text NOT NULL,
  current_company_id uuid REFERENCES canon.dim_company(company_id),
  current_market_id uuid REFERENCES canon.dim_market(market_id),
  current_submarket_id uuid REFERENCES canon.dim_submarket(submarket_id),
  current_geom geometry(Point, 4326),
  current_insight_flag boolean,
  is_active boolean NOT NULL,
  source_primary text NOT NULL CHECK (source_primary IN ('blc_product', 'hyperscale_facility', 'manual')),
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id)
);

CREATE INDEX IF NOT EXISTS dim_facility_current_geom_idx
  ON canon.dim_facility
  USING gist (current_geom);

CREATE INDEX IF NOT EXISTS dim_facility_current_market_idx
  ON canon.dim_facility (current_market_id);

CREATE TABLE IF NOT EXISTS canon.xwalk_market_source (
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  is_primary boolean NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (source_system, source_table, source_pk)
);

CREATE TABLE IF NOT EXISTS canon.xwalk_submarket_source (
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  submarket_id uuid NOT NULL REFERENCES canon.dim_submarket(submarket_id),
  is_primary boolean NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (source_system, source_table, source_pk)
);

CREATE TABLE IF NOT EXISTS canon.xwalk_company_source (
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  company_id uuid NOT NULL REFERENCES canon.dim_company(company_id),
  is_primary boolean NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (source_system, source_table, source_pk)
);

CREATE TABLE IF NOT EXISTS canon.xwalk_facility_source (
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_pk text NOT NULL,
  facility_id uuid NOT NULL REFERENCES canon.dim_facility(facility_id),
  is_primary boolean NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (source_system, source_table, source_pk)
);

CREATE TABLE IF NOT EXISTS canon.market_quarter_release (
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  publication_state text NOT NULL CHECK (publication_state IN ('live', 'inactive')),
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (market_id, period_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS market_quarter_release_current_idx
  ON canon.market_quarter_release (market_id, period_id)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.snapshot_colo_current (
  facility_id uuid PRIMARY KEY REFERENCES canon.dim_facility(facility_id),
  as_of_ts timestamptz NOT NULL,
  commissioned_mw numeric,
  available_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id)
);

CREATE TABLE IF NOT EXISTS canon.snapshot_hyperscale_current (
  facility_id uuid PRIMARY KEY REFERENCES canon.dim_facility(facility_id),
  as_of_ts timestamptz NOT NULL,
  owned_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id)
);

CREATE TABLE IF NOT EXISTS canon.fact_colo_facility_quarterly (
  facility_id uuid NOT NULL REFERENCES canon.dim_facility(facility_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  market_id_resolved uuid REFERENCES canon.dim_market(market_id),
  submarket_id_resolved uuid REFERENCES canon.dim_submarket(submarket_id),
  mapping_basis text NOT NULL CHECK (mapping_basis IN ('current_product_mapping', 'source_row', 'manual')),
  commissioned_mw numeric,
  available_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (facility_id, period_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_colo_facility_quarterly_current_idx
  ON canon.fact_colo_facility_quarterly (facility_id, period_id)
  WHERE is_current_version;

CREATE INDEX IF NOT EXISTS fact_colo_facility_quarterly_market_idx
  ON canon.fact_colo_facility_quarterly (market_id_resolved, period_id)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.fact_hyperscale_facility_quarterly (
  facility_id uuid NOT NULL REFERENCES canon.dim_facility(facility_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  market_id_resolved uuid REFERENCES canon.dim_market(market_id),
  owned_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric,
  source_live_flag boolean,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (facility_id, period_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_hyperscale_facility_quarterly_current_idx
  ON canon.fact_hyperscale_facility_quarterly (facility_id, period_id)
  WHERE is_current_version;

CREATE INDEX IF NOT EXISTS fact_hyperscale_facility_quarterly_market_idx
  ON canon.fact_hyperscale_facility_quarterly (market_id_resolved, period_id)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.fact_market_quarterly_official (
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  publication_state text NOT NULL CHECK (publication_state IN ('live', 'inactive')),
  commissioned_mw numeric,
  available_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric,
  provider_count integer,
  facility_count integer,
  preleasing_mw numeric,
  operator_planned_mw numeric,
  site_developer_planned_mw numeric,
  absorption_override_mw numeric,
  vacancy_pct_reported numeric,
  commentary_text text,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (market_id, period_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_market_quarterly_official_current_idx
  ON canon.fact_market_quarterly_official (market_id, period_id)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.fact_hs_company_market_leased_yearly (
  company_id uuid NOT NULL REFERENCES canon.dim_company(company_id),
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  leased_total numeric NOT NULL,
  source_family text NOT NULL CHECK (source_family IN ('core', 'grid')),
  is_authoritative boolean NOT NULL,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (company_id, market_id, period_id, source_family, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_hs_company_market_leased_yearly_current_idx
  ON canon.fact_hs_company_market_leased_yearly (company_id, market_id, period_id, source_family)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.fact_market_forecast (
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  metric_code text NOT NULL,
  scenario_code text NOT NULL DEFAULT '',
  value_numeric numeric NOT NULL,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (market_id, period_id, metric_code, scenario_code, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_market_forecast_current_idx
  ON canon.fact_market_forecast (market_id, period_id, metric_code, scenario_code)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.fact_market_pricing_forecast (
  market_id uuid NOT NULL REFERENCES canon.dim_market(market_id),
  period_id bigint NOT NULL REFERENCES canon.dim_period(period_id),
  pricing_metric_code text NOT NULL,
  scenario_code text NOT NULL DEFAULT '',
  value_numeric numeric NOT NULL,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  is_current_version boolean NOT NULL,
  provenance_id bigint NOT NULL REFERENCES canon.provenance_row(provenance_id),
  PRIMARY KEY (market_id, period_id, pricing_metric_code, scenario_code, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS fact_market_pricing_forecast_current_idx
  ON canon.fact_market_pricing_forecast (market_id, period_id, pricing_metric_code, scenario_code)
  WHERE is_current_version;

CREATE TABLE IF NOT EXISTS canon.coverage_current (
  entity_type text NOT NULL CHECK (entity_type IN ('facility', 'market', 'company')),
  entity_id uuid NOT NULL,
  segment text NOT NULL,
  coverage_status text NOT NULL CHECK (
    coverage_status IN (
      'snapshot_only',
      'live_history_complete',
      'live_history_partial',
      'preview_only',
      'stale',
      'none'
    )
  ),
  latest_live_period_id bigint REFERENCES canon.dim_period(period_id),
  latest_any_period_id bigint REFERENCES canon.dim_period(period_id),
  snapshot_present boolean NOT NULL,
  history_present boolean NOT NULL,
  is_insight_current boolean,
  freshness_status text NOT NULL,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (entity_type, entity_id, segment)
);

DROP FUNCTION IF EXISTS serve.area_capacity_quarterly_current_geometry(geometry, boolean);
DROP VIEW IF EXISTS serve.market_pricing_forecast_current;
DROP VIEW IF EXISTS serve.market_forecast_current;
DROP VIEW IF EXISTS serve.market_size_report_live;
DROP VIEW IF EXISTS serve.market_ttm_growth_live;
DROP VIEW IF EXISTS serve.market_preleasing_percentage_live;
DROP VIEW IF EXISTS serve.market_insight_live;
DROP VIEW IF EXISTS serve.facility_snapshot_vs_latest_live_quarter_drift;
DROP VIEW IF EXISTS serve.hyperscale_company_market_leased_latest_year;
DROP VIEW IF EXISTS serve.hyperscale_company_market_leased_yearly;
DROP VIEW IF EXISTS serve.submarket_quarterly_live;
DROP VIEW IF EXISTS serve.submarket_quarterly_preview;
DROP VIEW IF EXISTS serve.facility_capacity_quarterly_live;
DROP VIEW IF EXISTS serve.facility_capacity_quarterly_preview;
DROP VIEW IF EXISTS serve.facility_current;
DROP VIEW IF EXISTS serve.market_quarterly_live;
DROP VIEW IF EXISTS serve.market_quarterly_preview;
DROP VIEW IF EXISTS serve.market_release_current;

CREATE OR REPLACE VIEW serve.market_release_current AS
SELECT
  release.market_id,
  release.period_id,
  release.publication_state,
  release.revision_no,
  release.provenance_id
FROM canon.market_quarter_release AS release
WHERE release.is_current_version;

CREATE OR REPLACE VIEW serve.market_quarterly_preview AS
SELECT
  fact.market_id,
  market.canonical_name AS market_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  period.quarter_num,
  release.publication_state,
  fact.commissioned_mw,
  fact.available_mw,
  fact.under_construction_mw,
  fact.planned_mw,
  fact.provider_count,
  fact.facility_count,
  fact.preleasing_mw,
  fact.operator_planned_mw,
  fact.site_developer_planned_mw,
  fact.absorption_override_mw,
  fact.vacancy_pct_reported,
  fact.commentary_text,
  CASE
    WHEN release.publication_state = 'live' THEN 'official_stored'
    ELSE 'preview_stored'
  END AS metric_origin,
  'market_quarterly_official'::text AS source_basis,
  coverage.coverage_status
FROM canon.fact_market_quarterly_official AS fact
INNER JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
INNER JOIN serve.market_release_current AS release
  ON release.market_id = fact.market_id
 AND release.period_id = fact.period_id
LEFT JOIN canon.coverage_current AS coverage
  ON coverage.entity_type = 'market'
 AND coverage.entity_id = fact.market_id
 AND coverage.segment = 'insight'
WHERE fact.is_current_version;

CREATE OR REPLACE VIEW serve.market_quarterly_live AS
SELECT *
FROM serve.market_quarterly_preview
WHERE publication_state = 'live';

CREATE OR REPLACE VIEW serve.facility_current AS
SELECT
  facility.facility_id,
  facility.facility_kind,
  facility.canonical_name,
  facility.current_company_id,
  company.canonical_name AS current_company_name,
  facility.current_market_id,
  market.canonical_name AS current_market_name,
  facility.current_submarket_id,
  submarket.canonical_name AS current_submarket_name,
  facility.current_geom,
  facility.current_insight_flag,
  facility.source_primary,
  COALESCE(coverage.coverage_status, 'none') AS coverage_status,
  'current'::text AS geometry_basis
FROM canon.dim_facility AS facility
LEFT JOIN canon.dim_company AS company
  ON company.company_id = facility.current_company_id
LEFT JOIN canon.dim_market AS market
  ON market.market_id = facility.current_market_id
LEFT JOIN canon.dim_submarket AS submarket
  ON submarket.submarket_id = facility.current_submarket_id
LEFT JOIN canon.coverage_current AS coverage
  ON coverage.entity_type = 'facility'
 AND coverage.entity_id = facility.facility_id
 AND coverage.segment = facility.facility_kind;

CREATE OR REPLACE VIEW serve.facility_capacity_quarterly_preview AS
SELECT
  'colo'::text AS perspective,
  fact.facility_id,
  facility.canonical_name AS facility_name,
  facility.current_geom,
  fact.market_id_resolved AS market_id,
  market.canonical_name AS market_name,
  fact.submarket_id_resolved AS submarket_id,
  submarket.canonical_name AS submarket_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  period.quarter_num,
  COALESCE(release.publication_state, 'inactive') AS publication_state,
  'current'::text AS geometry_basis,
  CASE
    WHEN COALESCE(release.publication_state, 'inactive') = 'live' THEN 'official_stored'
    ELSE 'preview_stored'
  END AS metric_origin,
  COALESCE(coverage.coverage_status, 'none') AS coverage_status,
  'facility_quarterly_data'::text AS source_basis,
  fact.commissioned_mw,
  fact.available_mw,
  fact.under_construction_mw,
  fact.planned_mw
FROM canon.fact_colo_facility_quarterly AS fact
INNER JOIN canon.dim_facility AS facility
  ON facility.facility_id = fact.facility_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
LEFT JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id_resolved
LEFT JOIN canon.dim_submarket AS submarket
  ON submarket.submarket_id = fact.submarket_id_resolved
LEFT JOIN serve.market_release_current AS release
  ON release.market_id = fact.market_id_resolved
 AND release.period_id = fact.period_id
LEFT JOIN canon.coverage_current AS coverage
  ON coverage.entity_type = 'facility'
 AND coverage.entity_id = fact.facility_id
 AND coverage.segment = 'colo'
WHERE fact.is_current_version
UNION ALL
SELECT
  'hyperscale'::text AS perspective,
  fact.facility_id,
  facility.canonical_name AS facility_name,
  facility.current_geom,
  fact.market_id_resolved AS market_id,
  market.canonical_name AS market_name,
  facility.current_submarket_id AS submarket_id,
  submarket.canonical_name AS submarket_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  period.quarter_num,
  CASE
    WHEN release.publication_state IS NOT NULL THEN release.publication_state
    WHEN fact.source_live_flag IS TRUE THEN 'live'
    ELSE 'inactive'
  END AS publication_state,
  'current'::text AS geometry_basis,
  CASE
    WHEN release.publication_state IS NOT NULL OR fact.source_live_flag IS TRUE THEN 'official_stored'
    ELSE 'preview_stored'
  END AS metric_origin,
  COALESCE(coverage.coverage_status, 'none') AS coverage_status,
  'hyperscale_historical_capacity'::text AS source_basis,
  fact.owned_mw AS commissioned_mw,
  NULL::numeric AS available_mw,
  fact.under_construction_mw,
  fact.planned_mw
FROM canon.fact_hyperscale_facility_quarterly AS fact
INNER JOIN canon.dim_facility AS facility
  ON facility.facility_id = fact.facility_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
LEFT JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id_resolved
LEFT JOIN canon.dim_submarket AS submarket
  ON submarket.submarket_id = facility.current_submarket_id
LEFT JOIN serve.market_release_current AS release
  ON release.market_id = fact.market_id_resolved
 AND release.period_id = fact.period_id
LEFT JOIN canon.coverage_current AS coverage
  ON coverage.entity_type = 'facility'
 AND coverage.entity_id = fact.facility_id
 AND coverage.segment = 'hyperscale'
WHERE fact.is_current_version;

CREATE OR REPLACE VIEW serve.facility_capacity_quarterly_live AS
SELECT *
FROM serve.facility_capacity_quarterly_preview
WHERE publication_state = 'live';

CREATE OR REPLACE VIEW serve.market_preleasing_percentage_live AS
WITH live_quarters AS (
  SELECT
    market_rows.market_id,
    market_rows.market_name,
    market_rows.period_id,
    market_rows.period_label,
    market_rows.year_num,
    market_rows.quarter_num,
    market_rows.preleasing_mw,
    market_rows.absorption_override_mw,
    market_rows.commissioned_mw,
    market_rows.available_mw,
    market_rows.coverage_status,
    LAG(market_rows.commissioned_mw)
      OVER (
        PARTITION BY market_rows.market_id
        ORDER BY market_rows.year_num, market_rows.quarter_num
      ) AS previous_commissioned_mw,
    LAG(market_rows.available_mw)
      OVER (
        PARTITION BY market_rows.market_id
        ORDER BY market_rows.year_num, market_rows.quarter_num
      ) AS previous_available_mw,
    ROW_NUMBER()
      OVER (
        PARTITION BY market_rows.market_id
        ORDER BY market_rows.year_num DESC, market_rows.quarter_num DESC
      ) AS latest_rank
  FROM serve.market_quarterly_live AS market_rows
),
latest_quarters AS (
  SELECT
    live_quarters.market_id,
    live_quarters.market_name,
    live_quarters.period_id,
    live_quarters.period_label,
    live_quarters.year_num,
    live_quarters.quarter_num,
    live_quarters.preleasing_mw,
    live_quarters.commissioned_mw,
    live_quarters.coverage_status,
    CASE
      WHEN live_quarters.absorption_override_mw IS NOT NULL THEN live_quarters.absorption_override_mw
      WHEN live_quarters.previous_commissioned_mw IS NOT NULL
        AND live_quarters.previous_available_mw IS NOT NULL
        AND live_quarters.commissioned_mw IS NOT NULL
        AND live_quarters.available_mw IS NOT NULL
      THEN ROUND(
        (
          live_quarters.commissioned_mw
          - live_quarters.previous_commissioned_mw
          + live_quarters.previous_available_mw
          - live_quarters.available_mw
        )::numeric,
        1
      )
      ELSE NULL
    END AS absorption_mw,
    CASE
      WHEN live_quarters.absorption_override_mw IS NOT NULL THEN 'override'
      WHEN live_quarters.previous_commissioned_mw IS NOT NULL
        AND live_quarters.previous_available_mw IS NOT NULL
        AND live_quarters.commissioned_mw IS NOT NULL
        AND live_quarters.available_mw IS NOT NULL
      THEN 'derived'
      ELSE 'unavailable'
    END AS absorption_origin
  FROM live_quarters
  WHERE live_quarters.latest_rank = 1
)
SELECT
  latest_quarters.market_id,
  latest_quarters.market_name,
  latest_quarters.period_id,
  latest_quarters.period_label,
  latest_quarters.year_num,
  latest_quarters.quarter_num,
  latest_quarters.preleasing_mw,
  latest_quarters.absorption_mw,
  CASE
    WHEN latest_quarters.absorption_mw IS NOT NULL
      AND latest_quarters.absorption_mw <> 0
      AND latest_quarters.preleasing_mw IS NOT NULL
    THEN ROUND((latest_quarters.preleasing_mw / latest_quarters.absorption_mw) * 100.0, 1)
    ELSE NULL
  END AS preleasing_pct_of_absorption,
  CASE
    WHEN latest_quarters.commissioned_mw IS NOT NULL
      AND latest_quarters.commissioned_mw <> 0
      AND latest_quarters.preleasing_mw IS NOT NULL
    THEN ROUND((latest_quarters.preleasing_mw / latest_quarters.commissioned_mw) * 100.0, 1)
    ELSE NULL
  END AS preleasing_pct_of_commissioned,
  latest_quarters.absorption_origin,
  'hybrid'::text AS metric_origin,
  latest_quarters.coverage_status,
  'market_quarterly_live'::text AS source_basis
FROM latest_quarters;

CREATE OR REPLACE VIEW serve.market_size_report_live AS
WITH latest_live_market_quarter AS (
  SELECT DISTINCT ON (market_rows.market_id)
    market_rows.market_id,
    market_rows.market_name,
    market_rows.period_id,
    market_rows.period_label,
    market_rows.year_num,
    market_rows.quarter_num,
    market_rows.commissioned_mw AS colo_commissioned_mw,
    market_rows.coverage_status
  FROM serve.market_quarterly_live AS market_rows
  ORDER BY
    market_rows.market_id,
    market_rows.year_num DESC,
    market_rows.quarter_num DESC
),
market_year_hyperscale AS (
  SELECT DISTINCT ON (market_rows.market_id, market_rows.year_num)
    market_rows.market_id,
    market_rows.year_num,
    COALESCE(SUM(market_rows.commissioned_mw), 0) AS hyperscale_owned_mw
  FROM serve.facility_capacity_quarterly_live AS market_rows
  WHERE market_rows.perspective = 'hyperscale'
  GROUP BY
    market_rows.market_id,
    market_rows.year_num,
    market_rows.quarter_num
  ORDER BY
    market_rows.market_id,
    market_rows.year_num,
    market_rows.quarter_num DESC
)
SELECT
  latest_live_market_quarter.market_id,
  latest_live_market_quarter.market_name,
  latest_live_market_quarter.period_id,
  latest_live_market_quarter.period_label,
  latest_live_market_quarter.year_num,
  latest_live_market_quarter.quarter_num,
  COALESCE(latest_live_market_quarter.colo_commissioned_mw, 0) AS colo_commissioned_mw,
  COALESCE(market_year_hyperscale.hyperscale_owned_mw, 0) AS hyperscale_owned_mw,
  COALESCE(latest_live_market_quarter.colo_commissioned_mw, 0)
    + COALESCE(market_year_hyperscale.hyperscale_owned_mw, 0) AS total_market_size_mw,
  'derived'::text AS metric_origin,
  latest_live_market_quarter.coverage_status,
  'market_quarterly_live + facility_capacity_quarterly_live'::text AS source_basis
FROM latest_live_market_quarter
LEFT JOIN market_year_hyperscale
  ON market_year_hyperscale.market_id = latest_live_market_quarter.market_id
 AND market_year_hyperscale.year_num = latest_live_market_quarter.year_num;

CREATE OR REPLACE VIEW serve.market_ttm_growth_live AS
WITH latest_live_market_quarter AS (
  SELECT DISTINCT ON (market_rows.market_id)
    market_rows.market_id,
    market_rows.market_name,
    market_rows.period_id,
    market_rows.period_label,
    market_rows.year_num,
    market_rows.quarter_num,
    market_rows.commissioned_mw,
    market_rows.coverage_status
  FROM serve.market_quarterly_live AS market_rows
  ORDER BY
    market_rows.market_id,
    market_rows.year_num DESC,
    market_rows.quarter_num DESC
),
market_year_hyperscale AS (
  SELECT DISTINCT ON (market_rows.market_id, market_rows.year_num)
    market_rows.market_id,
    market_rows.year_num,
    COALESCE(SUM(market_rows.commissioned_mw), 0) AS hyperscale_owned_mw
  FROM serve.facility_capacity_quarterly_live AS market_rows
  WHERE market_rows.perspective = 'hyperscale'
  GROUP BY
    market_rows.market_id,
    market_rows.year_num,
    market_rows.quarter_num
  ORDER BY
    market_rows.market_id,
    market_rows.year_num,
    market_rows.quarter_num DESC
),
current_anchor AS (
  SELECT
    latest_live_market_quarter.market_id,
    latest_live_market_quarter.market_name,
    latest_live_market_quarter.coverage_status,
    CASE
      WHEN latest_live_market_quarter.quarter_num = 4 THEN latest_live_market_quarter.year_num
      ELSE (latest_live_market_quarter.year_num - 1)::smallint
    END AS anchor_year
  FROM latest_live_market_quarter
),
current_and_previous AS (
  SELECT
    current_anchor.market_id,
    current_anchor.market_name,
    current_anchor.coverage_status,
    current_anchor.anchor_year,
    current_market.period_id AS current_period_id,
    current_market.period_label AS current_period_label,
    current_market.commissioned_mw AS current_colo_commissioned_mw,
    previous_market.commissioned_mw AS previous_colo_commissioned_mw,
    COALESCE(current_hyperscale.hyperscale_owned_mw, 0) AS current_hyperscale_owned_mw,
    COALESCE(previous_hyperscale.hyperscale_owned_mw, 0) AS previous_hyperscale_owned_mw
  FROM current_anchor
  LEFT JOIN serve.market_quarterly_live AS current_market
    ON current_market.market_id = current_anchor.market_id
   AND current_market.year_num = current_anchor.anchor_year
   AND current_market.quarter_num = 4
  LEFT JOIN serve.market_quarterly_live AS previous_market
    ON previous_market.market_id = current_anchor.market_id
   AND previous_market.year_num = (current_anchor.anchor_year - 1)::smallint
   AND previous_market.quarter_num = 4
  LEFT JOIN market_year_hyperscale AS current_hyperscale
    ON current_hyperscale.market_id = current_anchor.market_id
   AND current_hyperscale.year_num = current_anchor.anchor_year
  LEFT JOIN market_year_hyperscale AS previous_hyperscale
    ON previous_hyperscale.market_id = current_anchor.market_id
   AND previous_hyperscale.year_num = (current_anchor.anchor_year - 1)::smallint
)
SELECT
  current_and_previous.market_id,
  current_and_previous.market_name,
  current_and_previous.current_period_id AS period_id,
  current_and_previous.current_period_label AS period_label,
  current_and_previous.anchor_year AS year_num,
  current_and_previous.current_colo_commissioned_mw,
  current_and_previous.previous_colo_commissioned_mw,
  current_and_previous.current_hyperscale_owned_mw,
  current_and_previous.previous_hyperscale_owned_mw,
  (
    COALESCE(current_and_previous.current_colo_commissioned_mw, 0)
    + COALESCE(current_and_previous.current_hyperscale_owned_mw, 0)
  ) AS current_total_market_size_mw,
  (
    COALESCE(current_and_previous.previous_colo_commissioned_mw, 0)
    + COALESCE(current_and_previous.previous_hyperscale_owned_mw, 0)
  ) AS previous_total_market_size_mw,
  CASE
    WHEN current_and_previous.previous_colo_commissioned_mw IS NOT NULL
      AND (
        COALESCE(current_and_previous.previous_colo_commissioned_mw, 0)
        + COALESCE(current_and_previous.previous_hyperscale_owned_mw, 0)
      ) <> 0
    THEN (
      (
        COALESCE(current_and_previous.current_colo_commissioned_mw, 0)
        + COALESCE(current_and_previous.current_hyperscale_owned_mw, 0)
      )
      - (
        COALESCE(current_and_previous.previous_colo_commissioned_mw, 0)
        + COALESCE(current_and_previous.previous_hyperscale_owned_mw, 0)
      )
    ) / (
      COALESCE(current_and_previous.previous_colo_commissioned_mw, 0)
      + COALESCE(current_and_previous.previous_hyperscale_owned_mw, 0)
    )
    ELSE NULL
  END AS growth_ratio,
  'derived'::text AS metric_origin,
  current_and_previous.coverage_status,
  'market_quarterly_live + facility_capacity_quarterly_live'::text AS source_basis
FROM current_and_previous
WHERE current_and_previous.current_period_id IS NOT NULL;

CREATE OR REPLACE VIEW serve.market_insight_live AS
SELECT
  size_rows.market_id,
  size_rows.market_name,
  size_rows.period_id,
  size_rows.period_label,
  size_rows.year_num,
  size_rows.quarter_num,
  size_rows.colo_commissioned_mw,
  size_rows.hyperscale_owned_mw,
  size_rows.total_market_size_mw,
  preleasing_rows.preleasing_mw,
  preleasing_rows.preleasing_pct_of_absorption,
  preleasing_rows.preleasing_pct_of_commissioned,
  growth_rows.growth_ratio,
  growth_rows.year_num AS growth_year_num,
  'derived'::text AS metric_origin,
  size_rows.coverage_status,
  'serve.market_size_report_live + serve.market_preleasing_percentage_live + serve.market_ttm_growth_live'::text
    AS source_basis
FROM serve.market_size_report_live AS size_rows
LEFT JOIN serve.market_preleasing_percentage_live AS preleasing_rows
  ON preleasing_rows.market_id = size_rows.market_id
LEFT JOIN serve.market_ttm_growth_live AS growth_rows
  ON growth_rows.market_id = size_rows.market_id;

CREATE OR REPLACE VIEW serve.facility_snapshot_vs_latest_live_quarter_drift AS
WITH latest_live_history AS (
  SELECT DISTINCT ON (history_rows.facility_id, history_rows.perspective)
    history_rows.perspective,
    history_rows.facility_id,
    history_rows.facility_name,
    history_rows.market_id,
    history_rows.market_name,
    history_rows.period_id,
    history_rows.period_label,
    history_rows.commissioned_mw,
    history_rows.available_mw,
    history_rows.under_construction_mw,
    history_rows.planned_mw,
    history_rows.coverage_status
  FROM serve.facility_capacity_quarterly_live AS history_rows
  ORDER BY
    history_rows.facility_id,
    history_rows.perspective,
    history_rows.year_num DESC,
    history_rows.quarter_num DESC
)
SELECT
  latest_live_history.perspective,
  latest_live_history.facility_id,
  latest_live_history.facility_name,
  latest_live_history.market_id,
  latest_live_history.market_name,
  latest_live_history.period_id AS latest_live_period_id,
  latest_live_history.period_label AS latest_live_period_label,
  COALESCE(colo_snapshot.as_of_ts, hyperscale_snapshot.as_of_ts) AS snapshot_as_of_ts,
  CASE
    WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.commissioned_mw
    ELSE hyperscale_snapshot.owned_mw
  END AS snapshot_commissioned_mw,
  latest_live_history.commissioned_mw AS latest_live_commissioned_mw,
  CASE
    WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.commissioned_mw
    ELSE hyperscale_snapshot.owned_mw
  END - latest_live_history.commissioned_mw AS commissioned_delta_mw,
  colo_snapshot.available_mw AS snapshot_available_mw,
  latest_live_history.available_mw AS latest_live_available_mw,
  colo_snapshot.available_mw - latest_live_history.available_mw AS available_delta_mw,
  CASE
    WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.under_construction_mw
    ELSE hyperscale_snapshot.under_construction_mw
  END AS snapshot_under_construction_mw,
  latest_live_history.under_construction_mw AS latest_live_under_construction_mw,
  (
    CASE
      WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.under_construction_mw
      ELSE hyperscale_snapshot.under_construction_mw
    END
  ) - latest_live_history.under_construction_mw AS under_construction_delta_mw,
  CASE
    WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.planned_mw
    ELSE hyperscale_snapshot.planned_mw
  END AS snapshot_planned_mw,
  latest_live_history.planned_mw AS latest_live_planned_mw,
  (
    CASE
      WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.planned_mw
      ELSE hyperscale_snapshot.planned_mw
    END
  ) - latest_live_history.planned_mw AS planned_delta_mw,
  latest_live_history.coverage_status,
  'current'::text AS geometry_basis,
  CASE
    WHEN latest_live_history.perspective = 'colo' AND colo_snapshot.facility_id IS NULL THEN 'missing_snapshot'
    WHEN latest_live_history.perspective = 'hyperscale' AND hyperscale_snapshot.facility_id IS NULL THEN 'missing_snapshot'
    WHEN COALESCE(
      ABS(
        (
          CASE
            WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.commissioned_mw
            ELSE hyperscale_snapshot.owned_mw
          END
        ) - latest_live_history.commissioned_mw
      ),
      0
    ) = 0
      AND COALESCE(ABS(colo_snapshot.available_mw - latest_live_history.available_mw), 0) = 0
      AND COALESCE(
        ABS(
          (
            CASE
              WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.under_construction_mw
              ELSE hyperscale_snapshot.under_construction_mw
            END
          ) - latest_live_history.under_construction_mw
        ),
        0
      ) = 0
      AND COALESCE(
        ABS(
          (
            CASE
              WHEN latest_live_history.perspective = 'colo' THEN colo_snapshot.planned_mw
              ELSE hyperscale_snapshot.planned_mw
            END
          ) - latest_live_history.planned_mw
        ),
        0
      ) = 0
    THEN 'aligned'
    ELSE 'drifted'
  END AS drift_status
FROM latest_live_history
LEFT JOIN canon.snapshot_colo_current AS colo_snapshot
  ON colo_snapshot.facility_id = latest_live_history.facility_id
LEFT JOIN canon.snapshot_hyperscale_current AS hyperscale_snapshot
  ON hyperscale_snapshot.facility_id = latest_live_history.facility_id;

CREATE OR REPLACE VIEW serve.submarket_quarterly_preview AS
SELECT
  source_rows.submarket_id,
  source_rows.submarket_name,
  source_rows.market_id,
  source_rows.market_name,
  source_rows.period_id,
  source_rows.period_label,
  source_rows.year_num,
  source_rows.quarter_num,
  source_rows.publication_state,
  source_rows.geometry_basis,
  COUNT(*)::bigint AS facility_count,
  COALESCE(SUM(source_rows.commissioned_mw), 0) AS commissioned_mw,
  COALESCE(SUM(source_rows.available_mw), 0) AS available_mw,
  COALESCE(SUM(source_rows.under_construction_mw), 0) AS under_construction_mw,
  COALESCE(SUM(source_rows.planned_mw), 0) AS planned_mw,
  'derived'::text AS metric_origin,
  'facility_capacity_quarterly_preview'::text AS source_basis
FROM serve.facility_capacity_quarterly_preview AS source_rows
WHERE source_rows.submarket_id IS NOT NULL
GROUP BY
  source_rows.submarket_id,
  source_rows.submarket_name,
  source_rows.market_id,
  source_rows.market_name,
  source_rows.period_id,
  source_rows.period_label,
  source_rows.year_num,
  source_rows.quarter_num,
  source_rows.publication_state,
  source_rows.geometry_basis;

CREATE OR REPLACE VIEW serve.submarket_quarterly_live AS
SELECT *
FROM serve.submarket_quarterly_preview
WHERE publication_state = 'live';

CREATE OR REPLACE VIEW serve.hyperscale_company_market_leased_yearly AS
SELECT
  fact.company_id,
  company.canonical_name AS company_name,
  fact.market_id,
  market.canonical_name AS market_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  fact.leased_total,
  fact.source_family,
  fact.is_authoritative,
  'official_stored'::text AS metric_origin,
  'hyperscale_company_lease_total'::text AS source_basis
FROM canon.fact_hs_company_market_leased_yearly AS fact
INNER JOIN canon.dim_company AS company
  ON company.company_id = fact.company_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
WHERE fact.is_current_version
  AND fact.is_authoritative;

CREATE OR REPLACE VIEW serve.hyperscale_company_market_leased_latest_year AS
SELECT DISTINCT ON (company_id, market_id)
  company_id,
  company_name,
  market_id,
  market_name,
  period_id,
  period_label,
  year_num,
  leased_total,
  source_family,
  is_authoritative
FROM serve.hyperscale_company_market_leased_yearly
ORDER BY company_id, market_id, year_num DESC, period_id DESC;

CREATE OR REPLACE VIEW serve.market_forecast_current AS
SELECT
  fact.market_id,
  market.canonical_name AS market_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  period.quarter_num,
  fact.metric_code,
  NULLIF(fact.scenario_code, '') AS scenario_code,
  fact.value_numeric,
  'official_stored'::text AS metric_origin,
  'insight_forecast'::text AS source_basis
FROM canon.fact_market_forecast AS fact
INNER JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
WHERE fact.is_current_version;

CREATE OR REPLACE VIEW serve.market_pricing_forecast_current AS
SELECT
  fact.market_id,
  market.canonical_name AS market_name,
  fact.period_id,
  period.label AS period_label,
  period.year_num,
  period.quarter_num,
  fact.pricing_metric_code,
  NULLIF(fact.scenario_code, '') AS scenario_code,
  fact.value_numeric,
  'official_stored'::text AS metric_origin,
  'insight_pricing_forecast'::text AS source_basis
FROM canon.fact_market_pricing_forecast AS fact
INNER JOIN canon.dim_market AS market
  ON market.market_id = fact.market_id
INNER JOIN canon.dim_period AS period
  ON period.period_id = fact.period_id
WHERE fact.is_current_version;

CREATE OR REPLACE FUNCTION serve.area_capacity_quarterly_current_geometry(
  area geometry,
  include_preview boolean DEFAULT false
)
RETURNS TABLE (
  period_id bigint,
  period_label text,
  year_num smallint,
  quarter_num smallint,
  perspective text,
  publication_basis text,
  geometry_basis text,
  leased_overlay_available boolean,
  facility_count bigint,
  commissioned_mw numeric,
  available_mw numeric,
  under_construction_mw numeric,
  planned_mw numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH selected_facilities AS (
    SELECT facility.facility_id
    FROM canon.dim_facility AS facility
    WHERE facility.current_geom IS NOT NULL
      AND ST_Intersects(facility.current_geom, area)
  ),
  source_rows AS (
    SELECT *
    FROM serve.facility_capacity_quarterly_preview
    WHERE include_preview
    UNION ALL
    SELECT *
    FROM serve.facility_capacity_quarterly_live
    WHERE NOT include_preview
  )
  SELECT
    source_rows.period_id,
    source_rows.period_label,
    source_rows.year_num,
    source_rows.quarter_num,
    source_rows.perspective,
    CASE
      WHEN include_preview THEN 'preview_allowed'
      ELSE 'live_only'
    END AS publication_basis,
    'current'::text AS geometry_basis,
    false AS leased_overlay_available,
    COUNT(*)::bigint AS facility_count,
    COALESCE(SUM(source_rows.commissioned_mw), 0) AS commissioned_mw,
    COALESCE(SUM(source_rows.available_mw), 0) AS available_mw,
    COALESCE(SUM(source_rows.under_construction_mw), 0) AS under_construction_mw,
    COALESCE(SUM(source_rows.planned_mw), 0) AS planned_mw
  FROM source_rows
  INNER JOIN selected_facilities
    ON selected_facilities.facility_id = source_rows.facility_id
  GROUP BY
    source_rows.period_id,
    source_rows.period_label,
    source_rows.year_num,
    source_rows.quarter_num,
    source_rows.perspective
  ORDER BY source_rows.year_num, source_rows.quarter_num NULLS FIRST, source_rows.perspective;
$$;

COMMIT;
