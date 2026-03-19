#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[market-canonical] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

SCHEMA_SQL="${ROOT_DIR}/scripts/sql/market-canonical-schema.sql"
if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DO $$
BEGIN
  IF to_regclass('market_source.markets') IS NULL THEN
    RAISE EXCEPTION 'market_source.* landing tables are required before loading canon.*';
  END IF;
END
$$;

INSERT INTO canon.load_batch (batch_kind, source_basis, notes)
VALUES (
  'market-canonical-refresh',
  'market_source',
  jsonb_build_object(
    'loader', 'scripts/load-market-canonical.sh',
    'publication_model', 'market-quarter-live-state',
    'geometry_basis', 'current'
  )
)
RETURNING load_batch_id \gset

TRUNCATE TABLE
  canon.coverage_current,
  canon.fact_market_pricing_forecast,
  canon.fact_market_forecast,
  canon.fact_hs_company_market_leased_yearly,
  canon.fact_market_quarterly_official,
  canon.fact_hyperscale_facility_quarterly,
  canon.fact_colo_facility_quarterly,
  canon.snapshot_hyperscale_current,
  canon.snapshot_colo_current,
  canon.market_quarter_release,
  canon.xwalk_facility_source,
  canon.xwalk_company_source,
  canon.xwalk_submarket_source,
  canon.xwalk_market_source,
  canon.dim_facility,
  canon.dim_company,
  canon.dim_submarket,
  canon.dim_market,
  canon.dim_period
RESTART IDENTITY;

INSERT INTO canon.dim_period (granularity, year_num, quarter_num, label)
SELECT DISTINCT
  'quarter' AS granularity,
  quarterly.year::smallint AS year_num,
  quarterly.quarter::smallint AS quarter_num,
  quarterly.year::text || ' Q' || quarterly.quarter::text AS label
FROM market_source.market_quarterly_data AS quarterly
WHERE quarterly.year IS NOT NULL
  AND quarterly.quarter BETWEEN 1 AND 4
UNION
SELECT DISTINCT
  'quarter' AS granularity,
  quarterly.year::smallint AS year_num,
  quarterly.quarter::smallint AS quarter_num,
  quarterly.year::text || ' Q' || quarterly.quarter::text AS label
FROM market_source.facility_quarterly_data AS quarterly
WHERE quarterly.year IS NOT NULL
  AND quarterly.quarter BETWEEN 1 AND 4
UNION
SELECT DISTINCT
  'quarter' AS granularity,
  quarterly.year::smallint AS year_num,
  quarterly.quarter::smallint AS quarter_num,
  quarterly.year::text || ' Q' || quarterly.quarter::text AS label
FROM market_source.hyperscale_historical_capacity AS quarterly
WHERE quarterly.year IS NOT NULL
  AND quarterly.quarter BETWEEN 1 AND 4
UNION
SELECT DISTINCT
  'year' AS granularity,
  yearly.year::smallint AS year_num,
  NULL::smallint AS quarter_num,
  yearly.year::text AS label
FROM market_source.market_yearly_data AS yearly
WHERE yearly.year IS NOT NULL
UNION
SELECT DISTINCT
  'year' AS granularity,
  yearly.year::smallint AS year_num,
  NULL::smallint AS quarter_num,
  yearly.year::text AS label
FROM market_source.hyperscale_company_lease_total AS yearly
WHERE yearly.year IS NOT NULL
UNION
SELECT DISTINCT
  'year' AS granularity,
  yearly.year::smallint AS year_num,
  NULL::smallint AS quarter_num,
  yearly.year::text AS label
FROM market_source.hs_grid_company_market_lease_total AS yearly
WHERE yearly.year IS NOT NULL
UNION
SELECT DISTINCT
  'year' AS granularity,
  yearly.year::smallint AS year_num,
  NULL::smallint AS quarter_num,
  yearly.year::text AS label
FROM market_source.insight_forecast AS yearly
WHERE yearly.year IS NOT NULL
UNION
SELECT DISTINCT
  'year' AS granularity,
  yearly.year::smallint AS year_num,
  NULL::smallint AS quarter_num,
  yearly.year::text AS label
FROM market_source.insight_pricing_forecast AS yearly
WHERE yearly.year IS NOT NULL;

WITH market_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_MARKET',
    market.market_id,
    :load_batch_id,
    COALESCE(market.updated_at, now()),
    md5(market.payload::text)
  FROM market_source.markets AS market
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.dim_market (
  market_id,
  canonical_name,
  region_name,
  is_active,
  provenance_id
)
SELECT
  canon.stable_uuid('market', market.market_id),
  market.name,
  COALESCE(NULLIF(BTRIM(market.search_region), ''), NULLIF(BTRIM(market.region), '')),
  true,
  market_provenance.provenance_id
FROM market_source.markets AS market
INNER JOIN market_provenance
  ON market_provenance.source_pk = market.market_id
WHERE NULLIF(BTRIM(market.market_id), '') IS NOT NULL
  AND NULLIF(BTRIM(market.name), '') IS NOT NULL;

INSERT INTO canon.xwalk_market_source (
  source_system,
  source_table,
  source_pk,
  market_id,
  is_primary,
  first_seen_at,
  last_seen_at
)
SELECT
  'market_source',
  'HAWK_MARKET',
  market.market_id,
  canon.stable_uuid('market', market.market_id),
  true,
  now(),
  now()
FROM market_source.markets AS market
WHERE NULLIF(BTRIM(market.market_id), '') IS NOT NULL;

WITH submarket_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_SUBMARKET',
    submarket.submarket_id,
    :load_batch_id,
    now(),
    md5(submarket.payload::text)
  FROM market_source.submarkets AS submarket
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.dim_submarket (
  submarket_id,
  market_id,
  canonical_name,
  is_active,
  provenance_id
)
SELECT
  canon.stable_uuid('submarket', submarket.submarket_id),
  canon.stable_uuid('market', submarket.market_id),
  COALESCE(NULLIF(BTRIM(submarket.name), ''), submarket.submarket_id),
  true,
  submarket_provenance.provenance_id
FROM market_source.submarkets AS submarket
INNER JOIN submarket_provenance
  ON submarket_provenance.source_pk = submarket.submarket_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', submarket.market_id)
WHERE NULLIF(BTRIM(submarket.submarket_id), '') IS NOT NULL
  AND NULLIF(BTRIM(submarket.market_id), '') IS NOT NULL;

INSERT INTO canon.xwalk_submarket_source (
  source_system,
  source_table,
  source_pk,
  submarket_id,
  is_primary,
  first_seen_at,
  last_seen_at
)
SELECT
  'market_source',
  'HAWK_SUBMARKET',
  submarket.submarket_id,
  canon.stable_uuid('submarket', submarket.submarket_id),
  true,
  now(),
  now()
FROM market_source.submarkets AS submarket
INNER JOIN canon.dim_submarket AS canonical_submarket
  ON canonical_submarket.submarket_id = canon.stable_uuid('submarket', submarket.submarket_id)
WHERE NULLIF(BTRIM(submarket.submarket_id), '') IS NOT NULL;

WITH grouped_company AS (
  SELECT
    company_name,
    BOOL_OR(is_active_source) AS is_active,
    MAX(extracted_at) AS extracted_at
  FROM (
    SELECT
      NULLIF(BTRIM(company.company_name), '') AS company_name,
      NOT company.archived AS is_active_source,
      now() AS extracted_at
    FROM market_source.companies AS company
    WHERE NULLIF(BTRIM(company.company_name), '') IS NOT NULL
    UNION ALL
    SELECT
      NULLIF(BTRIM(point.company), '') AS company_name,
      true AS is_active_source,
      COALESCE(point.updated_at, now()) AS extracted_at
    FROM market_source.hyperscale_points AS point
    WHERE NULLIF(BTRIM(point.company), '') IS NOT NULL
  ) AS company_source
  WHERE company_name IS NOT NULL
  GROUP BY company_name
),
company_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'COMPANY_CANONICAL_NAME',
    grouped_company.company_name,
    :load_batch_id,
    grouped_company.extracted_at,
    md5(grouped_company.company_name)
  FROM grouped_company
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.dim_company (
  company_id,
  canonical_name,
  company_kind,
  is_active,
  provenance_id
)
SELECT
  canon.stable_uuid('company', company_provenance.source_pk),
  company_provenance.source_pk,
  'hyperscaler',
  grouped_company.is_active,
  company_provenance.provenance_id
FROM company_provenance
INNER JOIN grouped_company
  ON grouped_company.company_name = company_provenance.source_pk;

INSERT INTO canon.xwalk_company_source (
  source_system,
  source_table,
  source_pk,
  company_id,
  is_primary,
  first_seen_at,
  last_seen_at
)
SELECT
  'market_source',
  'HAWK_COMPANY',
  company_source.company_id,
  canon.stable_uuid('company', company_source.company_name),
  true,
  now(),
  now()
FROM market_source.companies AS company_source
WHERE NULLIF(BTRIM(company_source.company_id), '') IS NOT NULL
  AND NULLIF(BTRIM(company_source.company_name), '') IS NOT NULL
UNION ALL
SELECT
  'market_source',
  'HYPERSCALE_FACILITY.COMPANY',
  point.company,
  canon.stable_uuid('company', point.company),
  false,
  now(),
  now()
FROM (
  SELECT DISTINCT BTRIM(company) AS company
  FROM market_source.hyperscale_points
  WHERE NULLIF(BTRIM(company), '') IS NOT NULL
) AS point;

WITH colocation_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'BLC_PRODUCT',
    point.point_id,
    :load_batch_id,
    now(),
    md5(point.payload::text)
  FROM market_source.colocation_points AS point
  RETURNING provenance_id, source_pk
),
hyperscale_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HYPERSCALE_FACILITY',
    point.point_id,
    :load_batch_id,
    COALESCE(point.updated_at, now()),
    md5(point.payload::text)
  FROM market_source.hyperscale_points AS point
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.dim_facility (
  facility_id,
  facility_kind,
  canonical_name,
  current_company_id,
  current_market_id,
  current_submarket_id,
  current_geom,
  current_insight_flag,
  is_active,
  source_primary,
  provenance_id
)
SELECT
  canon.stable_uuid('facility-blc_product', point.point_id),
  'colo',
  COALESCE(
    NULLIF(BTRIM(point.facility_location_id), ''),
    NULLIF(BTRIM(point.address_line1), ''),
    point.point_id
  ),
  NULL::uuid,
  canon.stable_uuid('market', point.market_id),
  NULL::uuid,
  point.geom,
  NULL::boolean,
  true,
  'blc_product',
  provenance.provenance_id
FROM market_source.colocation_points AS point
INNER JOIN colocation_provenance AS provenance
  ON provenance.source_pk = point.point_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', point.market_id)
WHERE NULLIF(BTRIM(point.point_id), '') IS NOT NULL
UNION ALL
SELECT
  canon.stable_uuid('facility-hyperscale_facility', point.point_id),
  'hyperscale',
  COALESCE(
    NULLIF(BTRIM(point.facility_code), ''),
    NULLIF(BTRIM(point.address), ''),
    point.point_id
  ),
  company.company_id,
  market.market_id,
  submarket.submarket_id,
  point.geom,
  NULL::boolean,
  true,
  'hyperscale_facility',
  provenance.provenance_id
FROM market_source.hyperscale_points AS point
INNER JOIN hyperscale_provenance AS provenance
  ON provenance.source_pk = point.point_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', point.market_id)
LEFT JOIN canon.dim_company AS company
  ON company.company_id = canon.stable_uuid('company', BTRIM(point.company))
LEFT JOIN canon.dim_submarket AS submarket
  ON submarket.submarket_id = canon.stable_uuid('submarket', point.submarket_id)
WHERE NULLIF(BTRIM(point.point_id), '') IS NOT NULL;

INSERT INTO canon.xwalk_facility_source (
  source_system,
  source_table,
  source_pk,
  facility_id,
  is_primary,
  first_seen_at,
  last_seen_at
)
SELECT
  'market_source',
  'BLC_PRODUCT',
  point.point_id,
  canon.stable_uuid('facility-blc_product', point.point_id),
  true,
  now(),
  now()
FROM market_source.colocation_points AS point
WHERE NULLIF(BTRIM(point.point_id), '') IS NOT NULL
UNION ALL
SELECT
  'market_source',
  'HYPERSCALE_FACILITY',
  point.point_id,
  canon.stable_uuid('facility-hyperscale_facility', point.point_id),
  true,
  now(),
  now()
FROM market_source.hyperscale_points AS point
WHERE NULLIF(BTRIM(point.point_id), '') IS NOT NULL;

WITH missing_colo_history_facilities AS (
  SELECT DISTINCT
    quarterly.facility_id
  FROM market_source.facility_quarterly_data AS quarterly
  LEFT JOIN canon.xwalk_facility_source AS xwalk
    ON xwalk.source_system = 'market_source'
   AND xwalk.source_table = 'BLC_PRODUCT'
   AND xwalk.source_pk = quarterly.facility_id
  WHERE NULLIF(BTRIM(quarterly.facility_id), '') IS NOT NULL
    AND quarterly.year IS NOT NULL
    AND quarterly.quarter BETWEEN 1 AND 4
    AND xwalk.facility_id IS NULL
),
history_only_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_FACILITY_QUARTERLY_DATA.FACILITY',
    missing.facility_id,
    :load_batch_id,
    now(),
    md5(missing.facility_id || ':historical-only')
  FROM missing_colo_history_facilities AS missing
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.dim_facility (
  facility_id,
  facility_kind,
  canonical_name,
  current_company_id,
  current_market_id,
  current_submarket_id,
  current_geom,
  current_insight_flag,
  is_active,
  source_primary,
  provenance_id
)
SELECT
  canon.stable_uuid('facility-blc_product', provenance.source_pk),
  'colo',
  provenance.source_pk,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL,
  NULL::boolean,
  true,
  'blc_product',
  provenance.provenance_id
FROM history_only_provenance AS provenance;

INSERT INTO canon.xwalk_facility_source (
  source_system,
  source_table,
  source_pk,
  facility_id,
  is_primary,
  first_seen_at,
  last_seen_at
)
SELECT
  'market_source',
  'BLC_PRODUCT',
  missing.facility_id,
  canon.stable_uuid('facility-blc_product', missing.facility_id),
  true,
  now(),
  now()
FROM (
  SELECT DISTINCT facility_id
  FROM market_source.facility_quarterly_data
  WHERE NULLIF(BTRIM(facility_id), '') IS NOT NULL
    AND year IS NOT NULL
    AND quarter BETWEEN 1 AND 4
) AS missing
LEFT JOIN canon.xwalk_facility_source AS xwalk
  ON xwalk.source_system = 'market_source'
 AND xwalk.source_table = 'BLC_PRODUCT'
 AND xwalk.source_pk = missing.facility_id
WHERE xwalk.facility_id IS NULL;

WITH latest_market_quarterly_source AS (
  SELECT DISTINCT ON (quarterly.market_id, quarterly.year, quarterly.quarter)
    quarterly.quarterly_data_id,
    quarterly.market_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.commissioned_power,
    quarterly.available_power,
    quarterly.uc_power,
    quarterly.planned_dc_power,
    quarterly.absorption_override,
    quarterly.preleasing_override,
    quarterly.date_updated,
    quarterly.payload
  FROM market_source.market_quarterly_data AS quarterly
  WHERE NULLIF(BTRIM(quarterly.market_id), '') IS NOT NULL
    AND quarterly.year IS NOT NULL
    AND quarterly.quarter BETWEEN 1 AND 4
  ORDER BY
    quarterly.market_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.date_updated DESC NULLS LAST,
    quarterly.quarterly_data_id DESC
),
release_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_MARKET_QUARTERLY_DATA',
    quarterly.quarterly_data_id,
    :load_batch_id,
    COALESCE(quarterly.date_updated, now()),
    md5(quarterly.payload::text)
  FROM latest_market_quarterly_source AS quarterly
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.market_quarter_release (
  market_id,
  period_id,
  publication_state,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  canon.stable_uuid('market', quarterly.market_id),
  period.period_id,
  CASE
    WHEN UPPER(COALESCE(NULLIF(BTRIM(quarterly.payload->>'STATE_TYPE'), ''), 'INACTIVE')) = 'LIVE'
      THEN 'live'
    ELSE 'inactive'
  END,
  1,
  true,
  release_provenance.provenance_id
FROM market_source.market_quarterly_data AS quarterly
INNER JOIN release_provenance
  ON release_provenance.source_pk = quarterly.quarterly_data_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', quarterly.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'quarter'
 AND period.year_num = quarterly.year::smallint
 AND period.quarter_num = quarterly.quarter::smallint
WHERE NULLIF(BTRIM(quarterly.market_id), '') IS NOT NULL
  AND quarterly.year IS NOT NULL
  AND quarterly.quarter BETWEEN 1 AND 4;

WITH latest_market_quarterly_source AS (
  SELECT DISTINCT ON (quarterly.market_id, quarterly.year, quarterly.quarter)
    quarterly.quarterly_data_id,
    quarterly.market_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.commissioned_power,
    quarterly.available_power,
    quarterly.uc_power,
    quarterly.planned_dc_power,
    quarterly.absorption_override,
    quarterly.preleasing_override,
    quarterly.date_updated,
    quarterly.payload
  FROM market_source.market_quarterly_data AS quarterly
  WHERE NULLIF(BTRIM(quarterly.market_id), '') IS NOT NULL
    AND quarterly.year IS NOT NULL
    AND quarterly.quarter BETWEEN 1 AND 4
  ORDER BY
    quarterly.market_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.date_updated DESC NULLS LAST,
    quarterly.quarterly_data_id DESC
),
fact_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_MARKET_QUARTERLY_DATA_FACT',
    quarterly.quarterly_data_id,
    :load_batch_id,
    COALESCE(quarterly.date_updated, now()),
    md5(quarterly.payload::text || ':fact')
  FROM latest_market_quarterly_source AS quarterly
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_market_quarterly_official (
  market_id,
  period_id,
  publication_state,
  commissioned_mw,
  available_mw,
  under_construction_mw,
  planned_mw,
  provider_count,
  facility_count,
  preleasing_mw,
  operator_planned_mw,
  site_developer_planned_mw,
  absorption_override_mw,
  vacancy_pct_reported,
  commentary_text,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  canon.stable_uuid('market', quarterly.market_id),
  period.period_id,
  CASE
    WHEN UPPER(COALESCE(NULLIF(BTRIM(quarterly.payload->>'STATE_TYPE'), ''), 'INACTIVE')) = 'LIVE'
      THEN 'live'
    ELSE 'inactive'
  END,
  quarterly.commissioned_power,
  quarterly.available_power,
  quarterly.uc_power,
  quarterly.planned_dc_power,
  CASE
    WHEN NULLIF(BTRIM(quarterly.payload->>'PROVIDER_COUNT'), '') ~ '^-?[0-9]+$'
      THEN (quarterly.payload->>'PROVIDER_COUNT')::integer
    ELSE NULL
  END,
  CASE
    WHEN NULLIF(BTRIM(quarterly.payload->>'FACILITY_COUNT'), '') ~ '^-?[0-9]+$'
      THEN (quarterly.payload->>'FACILITY_COUNT')::integer
    ELSE NULL
  END,
  COALESCE(
    quarterly.preleasing_override,
    CASE
      WHEN quarterly.preleasing IS NOT NULL THEN quarterly.preleasing::numeric / 1000.0
      ELSE NULL
    END
  ),
  CASE
    WHEN NULLIF(BTRIM(quarterly.payload->>'OPERATOR_PLANNED_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (quarterly.payload->>'OPERATOR_PLANNED_POWER')::numeric
    ELSE NULL
  END,
  CASE
    WHEN NULLIF(BTRIM(quarterly.payload->>'SITE_DEVELOPER_PLANNED_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (quarterly.payload->>'SITE_DEVELOPER_PLANNED_POWER')::numeric
    ELSE NULL
  END,
  quarterly.absorption_override,
  NULL,
  NULLIF(BTRIM(quarterly.payload->>'MARKET_UPDATES'), ''),
  1,
  true,
  fact_provenance.provenance_id
FROM market_source.market_quarterly_data AS quarterly
INNER JOIN fact_provenance
  ON fact_provenance.source_pk = quarterly.quarterly_data_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', quarterly.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'quarter'
 AND period.year_num = quarterly.year::smallint
 AND period.quarter_num = quarterly.quarter::smallint
WHERE NULLIF(BTRIM(quarterly.market_id), '') IS NOT NULL
  AND quarterly.year IS NOT NULL
  AND quarterly.quarter BETWEEN 1 AND 4;

WITH latest_colo_snapshot_source AS (
  SELECT DISTINCT ON (snapshot.power_space_info_id)
    snapshot.power_space_info_id,
    snapshot.available_power,
    snapshot.commissioned_power,
    snapshot.planned_dc_power,
    snapshot.under_construction_power,
    snapshot.date_updated,
    snapshot.payload
  FROM market_source.power_space_info AS snapshot
  WHERE NULLIF(BTRIM(snapshot.power_space_info_id), '') IS NOT NULL
  ORDER BY
    snapshot.power_space_info_id,
    snapshot.date_updated DESC NULLS LAST,
    snapshot.power_space_info_id DESC
),
snapshot_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_POWER_SPACE_INFO',
    snapshot.power_space_info_id,
    :load_batch_id,
    COALESCE(snapshot.date_updated, now()),
    md5(snapshot.payload::text)
  FROM latest_colo_snapshot_source AS snapshot
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.snapshot_colo_current (
  facility_id,
  as_of_ts,
  commissioned_mw,
  available_mw,
  under_construction_mw,
  planned_mw,
  provenance_id
)
SELECT
  facility_xwalk.facility_id,
  COALESCE(snapshot.date_updated, now()),
  snapshot.commissioned_power,
  snapshot.available_power,
  snapshot.under_construction_power,
  snapshot.planned_dc_power,
  snapshot_provenance.provenance_id
FROM latest_colo_snapshot_source AS snapshot
INNER JOIN snapshot_provenance
  ON snapshot_provenance.source_pk = snapshot.power_space_info_id
INNER JOIN canon.xwalk_facility_source AS facility_xwalk
  ON facility_xwalk.source_system = 'market_source'
 AND facility_xwalk.source_table = 'BLC_PRODUCT'
 AND facility_xwalk.source_pk = snapshot.power_space_info_id;

WITH latest_hyperscale_snapshot_source AS (
  SELECT DISTINCT ON (snapshot.facility_id)
    snapshot.facility_id,
    snapshot.commissioned_power,
    snapshot.estimated_commissioned_power,
    snapshot.under_construction_power,
    snapshot.planned_power,
    snapshot.date_updated,
    snapshot.payload
  FROM market_source.hyperscale_facility_current AS snapshot
  WHERE NULLIF(BTRIM(snapshot.facility_id), '') IS NOT NULL
  ORDER BY
    snapshot.facility_id,
    snapshot.date_updated DESC NULLS LAST,
    snapshot.facility_id DESC
),
snapshot_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HYPERSCALE_FACILITY_CURRENT',
    snapshot.facility_id,
    :load_batch_id,
    COALESCE(snapshot.date_updated, now()),
    md5(snapshot.payload::text)
  FROM latest_hyperscale_snapshot_source AS snapshot
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.snapshot_hyperscale_current (
  facility_id,
  as_of_ts,
  owned_mw,
  under_construction_mw,
  planned_mw,
  provenance_id
)
SELECT
  facility_xwalk.facility_id,
  COALESCE(snapshot.date_updated, now()),
  COALESCE(snapshot.commissioned_power, snapshot.estimated_commissioned_power),
  snapshot.under_construction_power,
  snapshot.planned_power,
  snapshot_provenance.provenance_id
FROM latest_hyperscale_snapshot_source AS snapshot
INNER JOIN snapshot_provenance
  ON snapshot_provenance.source_pk = snapshot.facility_id
INNER JOIN canon.xwalk_facility_source AS facility_xwalk
  ON facility_xwalk.source_system = 'market_source'
 AND facility_xwalk.source_table = 'HYPERSCALE_FACILITY'
 AND facility_xwalk.source_pk = snapshot.facility_id;

WITH latest_colo_quarterly_source AS (
  SELECT DISTINCT ON (quarterly.facility_id, quarterly.year, quarterly.quarter)
    quarterly.facility_quarterly_data_id,
    quarterly.facility_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.available_power,
    quarterly.commissioned_power,
    quarterly.planned_power,
    quarterly.under_construction_power,
    quarterly.date_updated,
    quarterly.payload
  FROM market_source.facility_quarterly_data AS quarterly
  WHERE NULLIF(BTRIM(quarterly.facility_id), '') IS NOT NULL
    AND quarterly.year IS NOT NULL
    AND quarterly.quarter BETWEEN 1 AND 4
  ORDER BY
    quarterly.facility_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.date_updated DESC NULLS LAST,
    quarterly.facility_quarterly_data_id DESC
),
fact_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HAWK_FACILITY_QUARTERLY_DATA',
    quarterly.facility_quarterly_data_id,
    :load_batch_id,
    COALESCE(quarterly.date_updated, now()),
    md5(quarterly.payload::text)
  FROM latest_colo_quarterly_source AS quarterly
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_colo_facility_quarterly (
  facility_id,
  period_id,
  market_id_resolved,
  submarket_id_resolved,
  mapping_basis,
  commissioned_mw,
  available_mw,
  under_construction_mw,
  planned_mw,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  facility.facility_id,
  period.period_id,
  facility.current_market_id,
  facility.current_submarket_id,
  'current_product_mapping',
  quarterly.commissioned_power,
  quarterly.available_power,
  quarterly.under_construction_power,
  quarterly.planned_power,
  1,
  true,
  fact_provenance.provenance_id
FROM latest_colo_quarterly_source AS quarterly
INNER JOIN fact_provenance
  ON fact_provenance.source_pk = quarterly.facility_quarterly_data_id
INNER JOIN canon.xwalk_facility_source AS facility_xwalk
  ON facility_xwalk.source_system = 'market_source'
 AND facility_xwalk.source_table = 'BLC_PRODUCT'
 AND facility_xwalk.source_pk = quarterly.facility_id
INNER JOIN canon.dim_facility AS facility
  ON facility.facility_id = facility_xwalk.facility_id
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'quarter'
 AND period.year_num = quarterly.year::smallint
 AND period.quarter_num = quarterly.quarter::smallint;

WITH latest_hyperscale_quarterly_source AS (
  SELECT DISTINCT ON (quarterly.facility_id, quarterly.year, quarterly.quarter)
    quarterly.historical_capacity_id,
    quarterly.facility_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.owned_power,
    quarterly.under_construction_power,
    quarterly.planned_power,
    quarterly.live,
    quarterly.payload
  FROM market_source.hyperscale_historical_capacity AS quarterly
  WHERE NULLIF(BTRIM(quarterly.facility_id), '') IS NOT NULL
    AND quarterly.year IS NOT NULL
    AND quarterly.quarter BETWEEN 1 AND 4
  ORDER BY
    quarterly.facility_id,
    quarterly.year,
    quarterly.quarter,
    quarterly.historical_capacity_id DESC
),
fact_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HYPERSCALE_HISTORICAL_CAPACITY',
    quarterly.historical_capacity_id,
    :load_batch_id,
    now(),
    md5(quarterly.payload::text)
  FROM latest_hyperscale_quarterly_source AS quarterly
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_hyperscale_facility_quarterly (
  facility_id,
  period_id,
  market_id_resolved,
  owned_mw,
  under_construction_mw,
  planned_mw,
  source_live_flag,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  facility.facility_id,
  period.period_id,
  facility.current_market_id,
  quarterly.owned_power,
  quarterly.under_construction_power,
  quarterly.planned_power,
  quarterly.live,
  1,
  true,
  fact_provenance.provenance_id
FROM latest_hyperscale_quarterly_source AS quarterly
INNER JOIN fact_provenance
  ON fact_provenance.source_pk = quarterly.historical_capacity_id
INNER JOIN canon.xwalk_facility_source AS facility_xwalk
  ON facility_xwalk.source_system = 'market_source'
 AND facility_xwalk.source_table = 'HYPERSCALE_FACILITY'
 AND facility_xwalk.source_pk = quarterly.facility_id
INNER JOIN canon.dim_facility AS facility
  ON facility.facility_id = facility_xwalk.facility_id
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'quarter'
 AND period.year_num = quarterly.year::smallint
 AND period.quarter_num = quarterly.quarter::smallint;

WITH latest_core_lease_source AS (
  SELECT DISTINCT ON (lease.company_id, lease.market_id, lease.year)
    lease.lease_total_id,
    lease.company_id,
    lease.market_id,
    lease.year,
    lease.total,
    lease.date_updated,
    lease.payload
  FROM market_source.hyperscale_company_lease_total AS lease
  WHERE NULLIF(BTRIM(lease.company_id), '') IS NOT NULL
    AND NULLIF(BTRIM(lease.market_id), '') IS NOT NULL
    AND lease.year IS NOT NULL
  ORDER BY
    lease.company_id,
    lease.market_id,
    lease.year,
    lease.date_updated DESC NULLS LAST,
    lease.lease_total_id DESC
),
core_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HYPERSCALE_COMPANY_LEASE_TOTAL',
    lease.lease_total_id,
    :load_batch_id,
    COALESCE(lease.date_updated, now()),
    md5(lease.payload::text)
  FROM latest_core_lease_source AS lease
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_hs_company_market_leased_yearly (
  company_id,
  market_id,
  period_id,
  leased_total,
  source_family,
  is_authoritative,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  company_xwalk.company_id,
  market.market_id,
  period.period_id,
  lease.total,
  'core',
  true,
  1,
  true,
  core_provenance.provenance_id
FROM latest_core_lease_source AS lease
INNER JOIN core_provenance
  ON core_provenance.source_pk = lease.lease_total_id
INNER JOIN canon.xwalk_company_source AS company_xwalk
  ON company_xwalk.source_system = 'market_source'
 AND company_xwalk.source_table = 'HAWK_COMPANY'
 AND company_xwalk.source_pk = lease.company_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', lease.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'year'
 AND period.year_num = lease.year::smallint;

WITH latest_grid_lease_source AS (
  SELECT DISTINCT ON (lease.company_id, lease.market_id, lease.year)
    lease.lease_total_id,
    lease.company_id,
    lease.market_id,
    lease.year,
    lease.total,
    lease.payload
  FROM market_source.hs_grid_company_market_lease_total AS lease
  WHERE NULLIF(BTRIM(lease.company_id), '') IS NOT NULL
    AND NULLIF(BTRIM(lease.market_id), '') IS NOT NULL
    AND lease.year IS NOT NULL
  ORDER BY
    lease.company_id,
    lease.market_id,
    lease.year,
    lease.lease_total_id DESC
),
grid_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'HS_GRID_COMPANY_MARKET_LEASE_TOTAL',
    lease.lease_total_id,
    :load_batch_id,
    now(),
    md5(lease.payload::text)
  FROM latest_grid_lease_source AS lease
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_hs_company_market_leased_yearly (
  company_id,
  market_id,
  period_id,
  leased_total,
  source_family,
  is_authoritative,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  company_xwalk.company_id,
  market.market_id,
  period.period_id,
  lease.total,
  'grid',
  false,
  1,
  true,
  grid_provenance.provenance_id
FROM latest_grid_lease_source AS lease
INNER JOIN grid_provenance
  ON grid_provenance.source_pk = lease.lease_total_id
INNER JOIN canon.xwalk_company_source AS company_xwalk
  ON company_xwalk.source_system = 'market_source'
 AND company_xwalk.source_table = 'HAWK_COMPANY'
 AND company_xwalk.source_pk = lease.company_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', lease.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'year'
 AND period.year_num = lease.year::smallint;

WITH latest_forecast_source AS (
  SELECT DISTINCT ON (forecast.market_id, forecast.year)
    forecast.forecast_id,
    forecast.market_id,
    forecast.year,
    forecast.commissioned_power,
    forecast.payload
  FROM market_source.insight_forecast AS forecast
  WHERE NULLIF(BTRIM(forecast.market_id), '') IS NOT NULL
    AND forecast.year IS NOT NULL
    AND forecast.commissioned_power IS NOT NULL
  ORDER BY
    forecast.market_id,
    forecast.year,
    forecast.forecast_id DESC
),
forecast_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'INSIGHT_FORECAST',
    forecast.forecast_id,
    :load_batch_id,
    now(),
    md5(forecast.payload::text)
  FROM latest_forecast_source AS forecast
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_market_forecast (
  market_id,
  period_id,
  metric_code,
  scenario_code,
  value_numeric,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  market.market_id,
  period.period_id,
  'commissioned_power',
  '',
  forecast.commissioned_power,
  1,
  true,
  forecast_provenance.provenance_id
FROM latest_forecast_source AS forecast
INNER JOIN forecast_provenance
  ON forecast_provenance.source_pk = forecast.forecast_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', forecast.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'year'
 AND period.year_num = forecast.year::smallint;

WITH latest_pricing_source AS (
  SELECT DISTINCT ON (forecast.market_id, forecast.year)
    forecast.pricing_forecast_id,
    forecast.market_id,
    forecast.year,
    forecast.retail_min,
    forecast.retail_max,
    forecast.wholesale_min,
    forecast.wholesale_max,
    forecast.hyper_min,
    forecast.hyper_max,
    forecast.absorption,
    forecast.date_updated,
    forecast.payload
  FROM market_source.insight_pricing_forecast AS forecast
  WHERE NULLIF(BTRIM(forecast.market_id), '') IS NOT NULL
    AND forecast.year IS NOT NULL
    AND NOT forecast.archived
  ORDER BY
    forecast.market_id,
    forecast.year,
    forecast.date_updated DESC NULLS LAST,
    forecast.pricing_forecast_id DESC
),
pricing_provenance AS (
  INSERT INTO canon.provenance_row (
    source_system,
    source_table,
    source_pk,
    load_batch_id,
    extracted_at,
    row_hash
  )
  SELECT
    'market_source',
    'INSIGHT_PRICING_FORECAST',
    forecast.pricing_forecast_id,
    :load_batch_id,
    COALESCE(forecast.date_updated, now()),
    md5(forecast.payload::text)
  FROM latest_pricing_source AS forecast
  RETURNING provenance_id, source_pk
)
INSERT INTO canon.fact_market_pricing_forecast (
  market_id,
  period_id,
  pricing_metric_code,
  scenario_code,
  value_numeric,
  revision_no,
  is_current_version,
  provenance_id
)
SELECT
  market.market_id,
  period.period_id,
  metric.metric_code,
  '',
  metric.metric_value,
  1,
  true,
  pricing_provenance.provenance_id
FROM latest_pricing_source AS forecast
INNER JOIN pricing_provenance
  ON pricing_provenance.source_pk = forecast.pricing_forecast_id
INNER JOIN canon.dim_market AS market
  ON market.market_id = canon.stable_uuid('market', forecast.market_id)
INNER JOIN canon.dim_period AS period
  ON period.granularity = 'year'
 AND period.year_num = forecast.year::smallint
CROSS JOIN LATERAL (
  VALUES
    ('retail_min', forecast.retail_min),
    ('retail_max', forecast.retail_max),
    ('wholesale_min', forecast.wholesale_min),
    ('wholesale_max', forecast.wholesale_max),
    ('hyper_min', forecast.hyper_min),
    ('hyper_max', forecast.hyper_max),
    ('absorption', forecast.absorption)
) AS metric(metric_code, metric_value)
WHERE metric.metric_value IS NOT NULL;

INSERT INTO canon.coverage_current (
  entity_type,
  entity_id,
  segment,
  coverage_status,
  latest_live_period_id,
  latest_any_period_id,
  snapshot_present,
  history_present,
  is_insight_current,
  freshness_status,
  computed_at
)
SELECT
  'market',
  market.market_id,
  'insight',
  CASE
    WHEN latest.latest_live_period_id IS NOT NULL THEN 'live_history_partial'
    WHEN latest.latest_any_period_id IS NOT NULL THEN 'preview_only'
    ELSE 'none'
  END,
  latest.latest_live_period_id,
  latest.latest_any_period_id,
  false,
  latest.latest_any_period_id IS NOT NULL,
  latest.latest_live_period_id IS NOT NULL,
  CASE
    WHEN latest.latest_live_period_id IS NOT NULL THEN 'current'
    WHEN latest.latest_any_period_id IS NOT NULL THEN 'preview'
    ELSE 'missing'
  END,
  now()
FROM canon.dim_market AS market
LEFT JOIN (
  SELECT
    release.market_id,
    MAX(release.period_id) FILTER (WHERE release.publication_state = 'live') AS latest_live_period_id,
    MAX(release.period_id) AS latest_any_period_id
  FROM canon.market_quarter_release AS release
  WHERE release.is_current_version
  GROUP BY release.market_id
) AS latest
  ON latest.market_id = market.market_id;

INSERT INTO canon.coverage_current (
  entity_type,
  entity_id,
  segment,
  coverage_status,
  latest_live_period_id,
  latest_any_period_id,
  snapshot_present,
  history_present,
  is_insight_current,
  freshness_status,
  computed_at
)
SELECT
  'facility',
  facility.facility_id,
  facility.facility_kind,
  CASE
    WHEN latest.latest_live_period_id IS NOT NULL THEN 'live_history_partial'
    WHEN latest.latest_any_period_id IS NOT NULL THEN 'preview_only'
    WHEN COALESCE(snapshot.snapshot_present, false) OR facility.current_geom IS NOT NULL THEN 'snapshot_only'
    ELSE 'none'
  END,
  latest.latest_live_period_id,
  latest.latest_any_period_id,
  COALESCE(snapshot.snapshot_present, false) OR facility.current_geom IS NOT NULL,
  latest.latest_any_period_id IS NOT NULL,
  facility.current_insight_flag,
  CASE
    WHEN latest.latest_live_period_id IS NOT NULL THEN 'current'
    WHEN latest.latest_any_period_id IS NOT NULL THEN 'preview'
    WHEN COALESCE(snapshot.snapshot_present, false) OR facility.current_geom IS NOT NULL THEN 'current'
    ELSE 'missing'
  END,
  now()
FROM canon.dim_facility AS facility
LEFT JOIN (
  SELECT
    preview.facility_id,
    MAX(preview.period_id) FILTER (WHERE preview.publication_state = 'live') AS latest_live_period_id,
    MAX(preview.period_id) AS latest_any_period_id
  FROM serve.facility_capacity_quarterly_preview AS preview
  GROUP BY preview.facility_id
) AS latest
  ON latest.facility_id = facility.facility_id
LEFT JOIN (
  SELECT snapshot.facility_id, true AS snapshot_present
  FROM canon.snapshot_colo_current AS snapshot
  UNION
  SELECT snapshot.facility_id, true AS snapshot_present
  FROM canon.snapshot_hyperscale_current AS snapshot
) AS snapshot
  ON snapshot.facility_id = facility.facility_id;

COMMIT;
SQL

echo "[market-canonical] canonical load complete"
