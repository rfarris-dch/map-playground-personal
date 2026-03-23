DO $$
BEGIN
  IF to_regclass('serve.facility_site') IS NULL THEN
    RAISE EXCEPTION 'missing source relation: serve.facility_site';
  END IF;

  IF to_regclass('serve.hyperscale_site') IS NULL THEN
    RAISE EXCEPTION 'missing source relation: serve.hyperscale_site';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS serve.facilities_dataset_manifest (
  dataset text PRIMARY KEY CHECK (dataset = 'facilities'),
  current_version text NOT NULL,
  previous_version text,
  published_at timestamptz NOT NULL DEFAULT now(),
  warm_profile_version text
);

COMMENT ON TABLE serve.facilities_dataset_manifest IS
  'Published facilities dataset manifest with current and previous version pointers for version-bound API reads.';

SELECT set_config(
  'map.refresh_facilities.dataset_version',
  COALESCE(NULLIF(BTRIM(:'dataset_version'), ''), ''),
  false
);

SELECT set_config(
  'map.refresh_facilities.warm_profile_version',
  COALESCE(NULLIF(BTRIM(:'warm_profile_version'), ''), ''),
  false
);

DO $body$
DECLARE
  dataset_version text :=
    NULLIF(current_setting('map.refresh_facilities.dataset_version', true), '');
  warm_profile_version text :=
    NULLIF(current_setting('map.refresh_facilities.warm_profile_version', true), '');
  colocation_table_name text;
  hyperscale_table_name text;
  colocation_facility_id_index_name text;
  colocation_geom_index_name text;
  colocation_provider_index_name text;
  hyperscale_facility_id_index_name text;
  hyperscale_geom_index_name text;
  hyperscale_provider_index_name text;
  current_version text;
  previous_version text;
  published_previous_version text;
BEGIN
  IF dataset_version IS NULL THEN
    RAISE EXCEPTION 'dataset_version psql variable is required';
  END IF;

  colocation_table_name := 'facility_site_fast__' || dataset_version;
  hyperscale_table_name := 'hyperscale_site_fast__' || dataset_version;
  colocation_facility_id_index_name := format(
    'fsf_%s_fid_idx',
    substr(md5(colocation_table_name), 1, 10)
  );
  colocation_geom_index_name := format('fsf_%s_geom_gix', substr(md5(colocation_table_name), 1, 10));
  colocation_provider_index_name := format(
    'fsf_%s_provider_idx',
    substr(md5(colocation_table_name), 1, 10)
  );
  hyperscale_facility_id_index_name := format(
    'hsf_%s_fid_idx',
    substr(md5(hyperscale_table_name), 1, 10)
  );
  hyperscale_geom_index_name := format(
    'hsf_%s_geom_gix',
    substr(md5(hyperscale_table_name), 1, 10)
  );
  hyperscale_provider_index_name := format(
    'hsf_%s_provider_idx',
    substr(md5(hyperscale_table_name), 1, 10)
  );

  EXECUTE format('DROP TABLE IF EXISTS serve.%I', colocation_table_name);
  EXECUTE format(
    $sql$
CREATE TABLE serve.%I AS
WITH ranked_facilities AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    COALESCE(
      NULLIF(BTRIM(provider.provider_name), ''),
      NULLIF(INITCAP(REPLACE(facility.provider_slug, '-', ' ')), ''),
      facility.provider_id
    ) AS provider_name,
    COALESCE(facility.county_fips, ''::text) AS county_fips,
    NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    NULL::numeric AS square_footage,
    facility.commissioned_semantic,
    NULL::text AS lease_or_own,
    NULL::text AS status_label,
    NULLIF(BTRIM(facility.provider_slug), '') AS facility_code,
    NULLIF(BTRIM(point_match.address), '') AS address,
    NULLIF(BTRIM(point_match.city), '') AS city,
    NULLIF(BTRIM(point_match.state), '') AS state,
    market.name AS market_name,
    ST_X(facility.geom) AS longitude,
    ST_Y(facility.geom) AS latitude,
    facility.geom,
    facility.geom_3857,
    facility.freshness_ts,
    ROW_NUMBER() OVER (
      PARTITION BY facility.facility_id
      ORDER BY facility.freshness_ts DESC NULLS LAST, facility.provider_id, facility.facility_name
    ) AS facility_rank
  FROM serve.facility_site AS facility
  LEFT JOIN facility_current.providers AS provider
    ON provider.provider_id = facility.provider_id
  LEFT JOIN LATERAL (
    SELECT
      point.address,
      point.city,
      point.state
    FROM spatial.colo_facility_points AS point
    WHERE 'colo:' || point.id::text = facility.facility_id
       OR ST_DWithin(point.geom, facility.geom, 0.001)
    ORDER BY
      CASE
        WHEN 'colo:' || point.id::text = facility.facility_id THEN 0
        ELSE 1
      END,
      point.geom <-> facility.geom
    LIMIT 1
  ) AS point_match ON true
  LEFT JOIN market_current.market_boundaries AS boundary
    ON ST_Contains(boundary.geom, facility.geom)
  LEFT JOIN market_current.markets AS market
    ON market.market_id = boundary.market_id
  WHERE facility.geom IS NOT NULL
    AND facility.geom_3857 IS NOT NULL
    AND facility.provider_id IS NOT NULL
),
deduped_facilities AS (
  SELECT
    facility_id,
    facility_name,
    provider_id,
    provider_name,
    county_fips,
    state_abbrev,
    commissioned_power_mw,
    planned_power_mw,
    under_construction_power_mw,
    available_power_mw,
    square_footage,
    commissioned_semantic,
    lease_or_own,
    status_label,
    facility_code,
    address,
    city,
    state,
    market_name,
    longitude,
    latitude,
    geom,
    geom_3857,
    freshness_ts
  FROM ranked_facilities
  WHERE facility_rank = 1
)
SELECT
  facility_id,
  facility_name,
  provider_id,
  provider_name,
  county_fips,
  state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  square_footage,
  commissioned_semantic,
  lease_or_own,
  status_label,
  facility_code,
  address,
  city,
  state,
  market_name,
  longitude,
  latitude,
  geom,
  geom_3857,
  freshness_ts,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(commissioned_power_mw, 0) DESC,
      COALESCE(available_power_mw, 0) DESC,
      COALESCE(under_construction_power_mw, 0) DESC,
      COALESCE(planned_power_mw, 0) DESC,
      facility_name ASC NULLS LAST,
      facility_id ASC
  ) AS display_rank
FROM deduped_facilities;
$sql$,
    colocation_table_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON serve.%I (facility_id)',
    colocation_facility_id_index_name,
    colocation_table_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON serve.%I USING GIST (geom_3857)',
    colocation_geom_index_name,
    colocation_table_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON serve.%I (provider_id)',
    colocation_provider_index_name,
    colocation_table_name
  );
  EXECUTE format('ANALYZE serve.%I', colocation_table_name);
  EXECUTE format(
    'COMMENT ON TABLE serve.%I IS %L',
    colocation_table_name,
    'Daily-enriched colocation facility read model for interactive map/API requests.'
  );

  EXECUTE format('DROP TABLE IF EXISTS serve.%I', hyperscale_table_name);
  EXECUTE format(
    $sql$
CREATE TABLE serve.%I AS
WITH ranked_hyperscale AS (
  SELECT
    facility.hyperscale_id AS facility_id,
    facility.facility_name,
    facility.provider_id,
    COALESCE(
      NULLIF(BTRIM(facility.facility_name), ''),
      NULLIF(BTRIM(provider.provider_name), ''),
      facility.provider_id
    ) AS provider_name,
    COALESCE(facility.county_fips, ''::text) AS county_fips,
    NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    NULL::numeric AS available_power_mw,
    NULL::numeric AS square_footage,
    facility.commissioned_semantic,
    facility.lease_or_own,
    NULL::text AS status_label,
    NULLIF(BTRIM(facility.facility_code), '') AS facility_code,
    NULLIF(BTRIM(point_match.address), '') AS address,
    NULLIF(BTRIM(point_match.city), '') AS city,
    NULLIF(BTRIM(point_match.state), '') AS state,
    market.name AS market_name,
    ST_X(facility.geom) AS longitude,
    ST_Y(facility.geom) AS latitude,
    facility.geom,
    facility.geom_3857,
    facility.freshness_ts,
    ROW_NUMBER() OVER (
      PARTITION BY facility.hyperscale_id
      ORDER BY facility.freshness_ts DESC NULLS LAST, facility.provider_id, facility.facility_name
    ) AS facility_rank
  FROM serve.hyperscale_site AS facility
  LEFT JOIN facility_current.providers AS provider
    ON provider.provider_id = facility.provider_id
  LEFT JOIN LATERAL (
    SELECT
      point.address,
      point.city,
      point.state
    FROM spatial.hyperscale_facility_points AS point
    WHERE ST_DWithin(facility.geom, point.geom, 0.001)
    ORDER BY point.geom <-> facility.geom
    LIMIT 1
  ) AS point_match ON true
  LEFT JOIN market_current.market_boundaries AS boundary
    ON ST_Contains(boundary.geom, facility.geom)
  LEFT JOIN market_current.markets AS market
    ON market.market_id = boundary.market_id
  WHERE facility.geom IS NOT NULL
    AND facility.geom_3857 IS NOT NULL
    AND facility.provider_id IS NOT NULL
),
deduped_hyperscale AS (
  SELECT
    facility_id,
    facility_name,
    provider_id,
    provider_name,
    county_fips,
    state_abbrev,
    commissioned_power_mw,
    planned_power_mw,
    under_construction_power_mw,
    available_power_mw,
    square_footage,
    commissioned_semantic,
    lease_or_own,
    status_label,
    facility_code,
    address,
    city,
    state,
    market_name,
    longitude,
    latitude,
    geom,
    geom_3857,
    freshness_ts
  FROM ranked_hyperscale
  WHERE facility_rank = 1
)
SELECT
  facility_id,
  facility_name,
  provider_id,
  provider_name,
  county_fips,
  state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  square_footage,
  commissioned_semantic,
  lease_or_own,
  status_label,
  facility_code,
  address,
  city,
  state,
  market_name,
  longitude,
  latitude,
  geom,
  geom_3857,
  freshness_ts,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(commissioned_power_mw, 0) DESC,
      COALESCE(available_power_mw, 0) DESC,
      COALESCE(under_construction_power_mw, 0) DESC,
      COALESCE(planned_power_mw, 0) DESC,
      facility_name ASC NULLS LAST,
      facility_id ASC
  ) AS display_rank
FROM deduped_hyperscale;
$sql$,
    hyperscale_table_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON serve.%I (facility_id)',
    hyperscale_facility_id_index_name,
    hyperscale_table_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON serve.%I USING GIST (geom_3857)',
    hyperscale_geom_index_name,
    hyperscale_table_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON serve.%I (provider_id)',
    hyperscale_provider_index_name,
    hyperscale_table_name
  );
  EXECUTE format('ANALYZE serve.%I', hyperscale_table_name);
  EXECUTE format(
    'COMMENT ON TABLE serve.%I IS %L',
    hyperscale_table_name,
    'Daily-enriched hyperscale facility read model for interactive map/API requests.'
  );

  SELECT
    manifest.current_version,
    manifest.previous_version
  INTO current_version, previous_version
  FROM serve.facilities_dataset_manifest AS manifest
  WHERE manifest.dataset = 'facilities'
  FOR UPDATE;

  published_previous_version :=
    CASE
      WHEN current_version IS NULL OR current_version = dataset_version THEN previous_version
      ELSE current_version
    END;

  INSERT INTO serve.facilities_dataset_manifest (
    dataset,
    current_version,
    previous_version,
    published_at,
    warm_profile_version
  )
  VALUES (
    'facilities',
    dataset_version,
    published_previous_version,
    now(),
    warm_profile_version
  )
  ON CONFLICT (dataset) DO UPDATE
  SET
    current_version = EXCLUDED.current_version,
    previous_version = EXCLUDED.previous_version,
    published_at = EXCLUDED.published_at,
    warm_profile_version = EXCLUDED.warm_profile_version;

  RAISE NOTICE 'Published facilities dataset version % (previous=%)', dataset_version, published_previous_version;
END
$body$;
