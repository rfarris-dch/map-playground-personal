BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS analytics_meta;

CREATE TABLE IF NOT EXISTS analytics.county_metrics_v1 (
  county_fips text PRIMARY KEY,
  data_version text NOT NULL,
  input_data_version text NOT NULL,
  computed_at timestamptz NOT NULL,
  formula_version text NOT NULL,
  dependency_run_ids text[] NOT NULL DEFAULT '{}'::text[],
  facility_count integer NOT NULL DEFAULT 0,
  hyperscale_count integer NOT NULL DEFAULT 0,
  enterprise_count integer NOT NULL DEFAULT 0,
  commissioned_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  planned_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  under_construction_power_mw numeric(12, 2) NOT NULL DEFAULT 0,
  quality_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT county_metrics_v1_county_fips_check CHECK (county_fips ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS county_metrics_v1_data_version_idx
  ON analytics.county_metrics_v1 (data_version);

CREATE TABLE IF NOT EXISTS analytics.county_scores_v1 (
  county_fips text PRIMARY KEY,
  data_version text NOT NULL,
  input_data_version text NOT NULL,
  computed_at timestamptz NOT NULL,
  formula_version text NOT NULL,
  dependency_run_ids text[] NOT NULL DEFAULT '{}'::text[],
  demand_score numeric(8, 4),
  generation_score numeric(8, 4),
  policy_score numeric(8, 4),
  composite_score numeric(8, 4),
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT county_scores_v1_county_fips_check CHECK (county_fips ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS county_scores_v1_data_version_idx
  ON analytics.county_scores_v1 (data_version);

CREATE INDEX IF NOT EXISTS county_scores_v1_composite_score_idx
  ON analytics.county_scores_v1 (composite_score DESC);

CREATE TABLE IF NOT EXISTS analytics_meta.county_score_publications (
  run_id text PRIMARY KEY,
  status text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  data_version text NOT NULL,
  input_data_version text NOT NULL,
  formula_version text NOT NULL,
  methodology_id text NOT NULL DEFAULT 'county-intelligence-alpha-v1',
  available_feature_families text[] NOT NULL DEFAULT '{}'::text[],
  missing_feature_families text[] NOT NULL DEFAULT '{}'::text[],
  source_county_count integer NOT NULL DEFAULT 0,
  scored_county_count integer NOT NULL DEFAULT 0,
  water_coverage_count integer NOT NULL DEFAULT 0,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE analytics_meta.county_score_publications
  ADD COLUMN IF NOT EXISTS methodology_id text;

ALTER TABLE analytics_meta.county_score_publications
  ADD COLUMN IF NOT EXISTS available_feature_families text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE analytics_meta.county_score_publications
  ADD COLUMN IF NOT EXISTS missing_feature_families text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE analytics_meta.county_score_publications
  ADD COLUMN IF NOT EXISTS source_county_count integer NOT NULL DEFAULT 0;

ALTER TABLE analytics_meta.county_score_publications
  ALTER COLUMN methodology_id SET DEFAULT 'county-intelligence-alpha-v1';

ALTER TABLE analytics_meta.county_score_publications
  ALTER COLUMN available_feature_families SET DEFAULT '{}'::text[];

ALTER TABLE analytics_meta.county_score_publications
  ALTER COLUMN missing_feature_families SET DEFAULT '{}'::text[];

ALTER TABLE analytics_meta.county_score_publications
  ALTER COLUMN source_county_count SET DEFAULT 0;

UPDATE analytics_meta.county_score_publications AS publication
SET methodology_id = COALESCE(
  NULLIF(BTRIM(publication.methodology_id), ''),
  NULLIF(BTRIM(publication.formula_version), ''),
  'county-intelligence-alpha-v1'
)
WHERE publication.methodology_id IS NULL
  OR BTRIM(publication.methodology_id) = '';

UPDATE analytics_meta.county_score_publications AS publication
SET
  available_feature_families = CASE
    WHEN COALESCE(array_length(publication.available_feature_families, 1), 0) = 0
      THEN COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(publication.notes -> 'available_feature_families') = 'array'
                THEN publication.notes -> 'available_feature_families'
              ELSE '[]'::jsonb
            END
          )
        ),
        '{}'::text[]
      )
    ELSE publication.available_feature_families
  END,
  missing_feature_families = CASE
    WHEN COALESCE(array_length(publication.missing_feature_families, 1), 0) = 0
      THEN COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(publication.notes -> 'missing_feature_families') = 'array'
                THEN publication.notes -> 'missing_feature_families'
              ELSE '[]'::jsonb
            END
          )
        ),
        '{}'::text[]
      )
    ELSE publication.missing_feature_families
  END
WHERE COALESCE(array_length(publication.available_feature_families, 1), 0) = 0
  OR COALESCE(array_length(publication.missing_feature_families, 1), 0) = 0;

DO $$
BEGIN
  IF to_regclass('serve.boundary_county_geom_lod1') IS NOT NULL THEN
    UPDATE analytics_meta.county_score_publications AS publication
    SET source_county_count = county_reference.source_county_count
    FROM (
      SELECT COUNT(*)::integer AS source_county_count
      FROM serve.boundary_county_geom_lod1
    ) AS county_reference
    WHERE publication.source_county_count = 0;
  END IF;
END $$;

ALTER TABLE analytics_meta.county_score_publications
  ALTER COLUMN methodology_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS county_score_publications_published_at_idx
  ON analytics_meta.county_score_publications (published_at DESC);

COMMIT;
