BEGIN;

CREATE TABLE IF NOT EXISTS serve.boundary_county_publication (
  relation_name text PRIMARY KEY,
  source_relation_name text NOT NULL,
  refreshed_at timestamptz NOT NULL,
  source_row_count integer NOT NULL,
  published_row_count integer NOT NULL,
  source_dataset_hash text NOT NULL,
  published_dataset_hash text NOT NULL
);

COMMENT ON TABLE serve.boundary_county_publication IS
  'Refresh audit for published serve.boundary_county_geom_lod* copies sourced from serve.admin_county_geom_lod*.';

DO $$
DECLARE
  lod_level text;
  source_relation_name text;
  target_relation_name text;
  source_row_count integer;
  published_row_count integer;
  source_dataset_hash text;
  published_dataset_hash text;
BEGIN
  FOREACH lod_level IN ARRAY ARRAY['1', '2', '3']
  LOOP
    source_relation_name := format('serve.admin_county_geom_lod%s', lod_level);
    target_relation_name := format('serve.boundary_county_geom_lod%s', lod_level);

    IF to_regclass(source_relation_name) IS NULL THEN
      RAISE EXCEPTION 'missing county boundary source relation: %', source_relation_name;
    END IF;

    IF to_regclass(target_relation_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %s (LIKE %s INCLUDING ALL)',
        target_relation_name,
        source_relation_name
      );
    END IF;

    EXECUTE format('TRUNCATE TABLE %s', target_relation_name);
    EXECUTE format('INSERT INTO %s SELECT * FROM %s', target_relation_name, source_relation_name);

    EXECUTE format(
      $sql$
        SELECT
          COUNT(*)::integer,
          md5(
            COALESCE(
              string_agg(
                md5(
                  concat_ws(
                    '|',
                    county_fips,
                    state_abbrev,
                    county_name,
                    COALESCE(area_sqkm::text, ''),
                    COALESCE(geom_hash, ''),
                    COALESCE(data_version, ''),
                    COALESCE(freshness_ts::text, ''),
                    encode(ST_AsEWKB(geom_3857), 'hex')
                  )
                ),
                '|' ORDER BY county_fips
              ),
              ''
            )
          )
        FROM %s
      $sql$,
      source_relation_name
    )
    INTO source_row_count, source_dataset_hash;

    EXECUTE format(
      $sql$
        SELECT
          COUNT(*)::integer,
          md5(
            COALESCE(
              string_agg(
                md5(
                  concat_ws(
                    '|',
                    county_fips,
                    state_abbrev,
                    county_name,
                    COALESCE(area_sqkm::text, ''),
                    COALESCE(geom_hash, ''),
                    COALESCE(data_version, ''),
                    COALESCE(freshness_ts::text, ''),
                    encode(ST_AsEWKB(geom_3857), 'hex')
                  )
                ),
                '|' ORDER BY county_fips
              ),
              ''
            )
          )
        FROM %s
      $sql$,
      target_relation_name
    )
    INTO published_row_count, published_dataset_hash;

    IF source_row_count <> published_row_count THEN
      RAISE EXCEPTION
        'boundary publication row-count mismatch for %, source=% target=%',
        target_relation_name,
        source_row_count,
        published_row_count;
    END IF;

    IF source_dataset_hash IS DISTINCT FROM published_dataset_hash THEN
      RAISE EXCEPTION 'boundary publication hash mismatch for %', target_relation_name;
    END IF;

    INSERT INTO serve.boundary_county_publication (
      relation_name,
      source_relation_name,
      refreshed_at,
      source_row_count,
      published_row_count,
      source_dataset_hash,
      published_dataset_hash
    )
    VALUES (
      target_relation_name,
      source_relation_name,
      now(),
      source_row_count,
      published_row_count,
      source_dataset_hash,
      published_dataset_hash
    )
    ON CONFLICT (relation_name) DO UPDATE
    SET
      source_relation_name = EXCLUDED.source_relation_name,
      refreshed_at = EXCLUDED.refreshed_at,
      source_row_count = EXCLUDED.source_row_count,
      published_row_count = EXCLUDED.published_row_count,
      source_dataset_hash = EXCLUDED.source_dataset_hash,
      published_dataset_hash = EXCLUDED.published_dataset_hash;
  END LOOP;
END
$$;

ANALYZE serve.boundary_county_publication;
ANALYZE serve.boundary_county_geom_lod1;
ANALYZE serve.boundary_county_geom_lod2;
ANALYZE serve.boundary_county_geom_lod3;

COMMENT ON TABLE serve.boundary_county_geom_lod1 IS
  'Published copy of serve.admin_county_geom_lod1. Refresh via scripts/refresh-county-boundaries.sh.';

COMMENT ON TABLE serve.boundary_county_geom_lod2 IS
  'Published copy of serve.admin_county_geom_lod2. Refresh via scripts/refresh-county-boundaries.sh.';

COMMENT ON TABLE serve.boundary_county_geom_lod3 IS
  'Published copy of serve.admin_county_geom_lod3. Refresh via scripts/refresh-county-boundaries.sh.';

COMMIT;
