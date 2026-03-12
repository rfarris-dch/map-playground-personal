BEGIN;

TRUNCATE TABLE facility_current.providers;

CREATE TEMP TABLE provider_profile_source (
  provider_id text PRIMARY KEY,
  provider_name text,
  category text,
  country text,
  state text,
  updated_at timestamptz
) ON COMMIT DROP;

CREATE TEMP TABLE hyperscale_provider_source (
  provider_id text PRIMARY KEY,
  provider_name text,
  country text,
  state text,
  updated_at timestamptz
) ON COMMIT DROP;

CREATE TEMP TABLE facility_location_source (
  facility_location_id text PRIMARY KEY,
  country text,
  state text
) ON COMMIT DROP;

DO $$
DECLARE
  best_relation text;
  best_count bigint;
  candidate record;
  candidate_count bigint;
BEGIN
  best_relation := NULL;
  best_count := -1;

  FOR candidate IN
    SELECT
      column_source.table_schema,
      column_source.table_name
    FROM information_schema.columns AS column_source
    WHERE column_source.table_schema NOT IN ('pg_catalog', 'information_schema', 'facility_current')
      AND column_source.column_name IN (
        'PROVIDER_PROFILE_ID',
        'NAME',
        'PROVIDER_CATEGORY',
        'COUNTRY',
        'STATE',
        'DATE_UPDATED'
      )
    GROUP BY column_source.table_schema, column_source.table_name
    HAVING COUNT(*) FILTER (WHERE column_source.column_name = 'PROVIDER_PROFILE_ID') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'NAME') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'PROVIDER_CATEGORY') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'COUNTRY') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'STATE') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'DATE_UPDATED') = 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', candidate.table_schema, candidate.table_name)
      INTO candidate_count;

    IF candidate_count > best_count THEN
      best_relation := format('%I.%I', candidate.table_schema, candidate.table_name);
      best_count := candidate_count;
    END IF;
  END LOOP;

  IF best_relation IS NOT NULL THEN
    EXECUTE format(
      $sql$
        INSERT INTO provider_profile_source (
          provider_id,
          provider_name,
          category,
          country,
          state,
          updated_at
        )
        SELECT
          "PROVIDER_PROFILE_ID"::text,
          NULLIF(BTRIM("NAME"), ''),
          NULLIF(BTRIM("PROVIDER_CATEGORY"), ''),
          NULLIF(BTRIM("COUNTRY"), ''),
          NULLIF(BTRIM("STATE"), ''),
          CASE
            WHEN NULLIF(BTRIM("DATE_UPDATED"::text), '') IS NULL THEN now()
            ELSE "DATE_UPDATED"::timestamptz
          END
        FROM %s
      $sql$,
      best_relation
    );
  END IF;

  best_relation := NULL;
  best_count := -1;

  FOR candidate IN
    SELECT
      column_source.table_schema,
      column_source.table_name
    FROM information_schema.columns AS column_source
    WHERE column_source.table_schema NOT IN ('pg_catalog', 'information_schema', 'facility_current')
      AND column_source.column_name IN ('ID', 'NAME', 'COUNTRY', 'STATE', 'DATE_UPDATED')
    GROUP BY column_source.table_schema, column_source.table_name
    HAVING COUNT(*) FILTER (WHERE column_source.column_name = 'ID') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'NAME') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'COUNTRY') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'STATE') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'DATE_UPDATED') = 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', candidate.table_schema, candidate.table_name)
      INTO candidate_count;

    IF candidate_count > best_count THEN
      best_relation := format('%I.%I', candidate.table_schema, candidate.table_name);
      best_count := candidate_count;
    END IF;
  END LOOP;

  IF best_relation IS NOT NULL THEN
    EXECUTE format(
      $sql$
        INSERT INTO hyperscale_provider_source (
          provider_id,
          provider_name,
          country,
          state,
          updated_at
        )
        SELECT
          "ID"::text,
          NULLIF(BTRIM("NAME"), ''),
          NULLIF(BTRIM("COUNTRY"), ''),
          NULLIF(BTRIM("STATE"), ''),
          CASE
            WHEN NULLIF(BTRIM("DATE_UPDATED"::text), '') IS NULL THEN now()
            ELSE "DATE_UPDATED"::timestamptz
          END
        FROM %s
      $sql$,
      best_relation
    );
  END IF;

  best_relation := NULL;
  best_count := -1;

  FOR candidate IN
    SELECT
      column_source.table_schema,
      column_source.table_name
    FROM information_schema.columns AS column_source
    WHERE column_source.table_schema NOT IN ('pg_catalog', 'information_schema', 'facility_current')
      AND column_source.column_name IN ('FACILITY_LOCATION_ID', 'COUNTRY', 'STATE')
    GROUP BY column_source.table_schema, column_source.table_name
    HAVING COUNT(*) FILTER (WHERE column_source.column_name = 'FACILITY_LOCATION_ID') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'COUNTRY') = 1
      AND COUNT(*) FILTER (WHERE column_source.column_name = 'STATE') = 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', candidate.table_schema, candidate.table_name)
      INTO candidate_count;

    IF candidate_count > best_count THEN
      best_relation := format('%I.%I', candidate.table_schema, candidate.table_name);
      best_count := candidate_count;
    END IF;
  END LOOP;

  IF best_relation IS NOT NULL THEN
    EXECUTE format(
      $sql$
        INSERT INTO facility_location_source (
          facility_location_id,
          country,
          state
        )
        SELECT
          "FACILITY_LOCATION_ID"::text,
          NULLIF(BTRIM("COUNTRY"), ''),
          NULLIF(BTRIM("STATE"), '')
        FROM %s
      $sql$,
      best_relation
    );
  END IF;
END $$;

WITH active_providers AS (
  SELECT
    facility.provider_id,
    MAX(NULLIF(BTRIM(facility.provider_slug), '')) AS provider_slug,
    MAX(facility.updated_at) AS latest_facility_updated_at,
    COUNT(*) FILTER (WHERE facility.perspective = 'colocation')::bigint AS colocation_listing_count,
    COUNT(*) FILTER (WHERE facility.perspective = 'hyperscale')::bigint AS hyperscale_listing_count
  FROM (
    SELECT
      provider_id,
      provider_slug,
      freshness_ts AS updated_at,
      'colocation'::text AS perspective
    FROM serve.facility_site
    WHERE provider_id IS NOT NULL
    UNION ALL
    SELECT
      provider_id,
      provider_slug,
      freshness_ts AS updated_at,
      'hyperscale'::text AS perspective
    FROM serve.hyperscale_site
    WHERE provider_id IS NOT NULL
  ) AS facility
  GROUP BY facility.provider_id
),
location_fallback AS (
  SELECT
    ranked.provider_id,
    ranked.country,
    ranked.state
  FROM (
    SELECT
      site.provider_id,
      location.country,
      location.state,
      COUNT(*) AS location_count,
      ROW_NUMBER() OVER (
        PARTITION BY site.provider_id
        ORDER BY COUNT(*) DESC, location.country NULLS LAST, location.state NULLS LAST
      ) AS location_rank
    FROM serve.facility_site AS site
    CROSS JOIN LATERAL jsonb_array_elements(site.source_row_ids) AS source_row
    INNER JOIN facility_location_source AS location
      ON location.facility_location_id = source_row ->> 'facility_location_id'
    WHERE site.provider_id IS NOT NULL
      AND source_row ? 'facility_location_id'
    GROUP BY site.provider_id, location.country, location.state
  ) AS ranked
  WHERE ranked.location_rank = 1
),
provider_catalog AS (
  SELECT
    active.provider_id,
    COALESCE(
      NULLIF(BTRIM(provider.provider_name), ''),
      NULLIF(BTRIM(hyperscale.provider_name), ''),
      NULLIF(INITCAP(REPLACE(active.provider_slug, '-', ' ')), ''),
      active.provider_id
    ) AS provider_name,
    COALESCE(
      NULLIF(BTRIM(provider.category), ''),
      CASE
        WHEN active.hyperscale_listing_count > 0 AND active.colocation_listing_count = 0
          THEN 'Hyperscale'
        ELSE 'Operator'
      END
    ) AS category,
    COALESCE(
      NULLIF(BTRIM(provider.country), ''),
      NULLIF(BTRIM(hyperscale.country), ''),
      NULLIF(BTRIM(location.country), '')
    ) AS country,
    COALESCE(
      NULLIF(BTRIM(provider.state), ''),
      NULLIF(BTRIM(hyperscale.state), ''),
      NULLIF(BTRIM(location.state), '')
    ) AS state,
    GREATEST(
      COALESCE(provider.updated_at, TIMESTAMPTZ 'epoch'),
      COALESCE(hyperscale.updated_at, TIMESTAMPTZ 'epoch'),
      COALESCE(active.latest_facility_updated_at, TIMESTAMPTZ 'epoch')
    ) AS updated_at
  FROM active_providers AS active
  LEFT JOIN provider_profile_source AS provider
    ON provider.provider_id = active.provider_id
  LEFT JOIN hyperscale_provider_source AS hyperscale
    ON hyperscale.provider_id = active.provider_id
  LEFT JOIN location_fallback AS location
    ON location.provider_id = active.provider_id
)
INSERT INTO facility_current.providers (
  provider_id,
  provider_name,
  category,
  country,
  state,
  updated_at
)
SELECT
  catalog.provider_id,
  catalog.provider_name,
  catalog.category,
  catalog.country,
  catalog.state,
  catalog.updated_at
FROM provider_catalog AS catalog;

ANALYZE facility_current.providers;

COMMIT;
