BEGIN;

DELETE FROM :overlay_table
WHERE run_id = :run_id_sql;

WITH flood_overlay_source AS (
  SELECT
    COALESCE(flood.dfirm_id, 'unknown') AS dfirm_id,
    flood.flood_band,
    flood.legend_key,
    flood.data_version,
    ST_CollectionExtract(ST_MakeValid(flood.geom_3857), 3) AS geom_3857
  FROM environmental_current.flood_hazard AS flood
  WHERE flood.run_id = :run_id_sql
    AND :overlay_filter
),
flood_overlay_groups AS (
  SELECT
    source.dfirm_id,
    source.flood_band,
    source.legend_key,
    source.data_version,
    ST_CollectionExtract(ST_MakeValid(ST_UnaryUnion(ST_Collect(source.geom_3857))), 3) AS geom_3857
  FROM flood_overlay_source AS source
  WHERE NOT ST_IsEmpty(source.geom_3857)
  GROUP BY
    source.dfirm_id,
    source.flood_band,
    source.legend_key,
    source.data_version
),
flood_overlay_parts AS (
  SELECT
    groups.dfirm_id,
    groups.flood_band,
    groups.legend_key,
    groups.data_version,
    dumped.geom AS geom_3857
  FROM flood_overlay_groups AS groups
  CROSS JOIN LATERAL ST_Dump(groups.geom_3857) AS dumped
),
flood_overlay_subdivided AS (
  SELECT
    parts.dfirm_id,
    parts.flood_band,
    parts.legend_key,
    parts.data_version,
    ST_CollectionExtract(ST_MakeValid(subdivided.geom), 3) AS geom_3857
  FROM flood_overlay_parts AS parts
  CROSS JOIN LATERAL ST_Subdivide(parts.geom_3857, :subdivide_vertices) AS subdivided(geom)
)
INSERT INTO :overlay_table (
  run_id,
  dfirm_id,
  flood_band,
  legend_key,
  data_version,
  geom_3857
)
SELECT
  :run_id_sql,
  dfirm_id,
  flood_band,
  legend_key,
  data_version,
  geom_3857
FROM flood_overlay_subdivided
WHERE NOT ST_IsEmpty(geom_3857);

ANALYZE :overlay_table;

COMMIT;

SELECT json_build_object(
  'overlay', :overlay_kind_sql,
  'runId', :run_id_sql,
  'featureCount', (
    SELECT count(*)
    FROM :overlay_table
    WHERE run_id = :run_id_sql
  )
)::text;
